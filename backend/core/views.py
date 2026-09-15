import json
import hashlib
import uuid
import redis
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.utils import timezone as django_timezone
from django.db import transaction, connection
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from core.models import (
    User, Tenant, TenantMembership, Device, Shipment, SensorReading, AuditEntry, StreamTicket,
    ShipmentStatus, ComplianceStatus, ROLE_PERMISSIONS
)
from core.serializers import (
    UserAuthContextSerializer, ShipmentSerializer, SensorReadingSerializer,
    AuditEntrySerializer, ComplianceReportSerializer, TenantMembershipSerializer,
    TelemetryInputSerializer
)
from core.authentication import generate_jwt_token
from core.permissions import has_tenant_permission, get_user_tenant_membership
from core.pagination import StandardPageNumberPagination


def compute_telemetry_hash(shipment_id, temperature, humidity, vibration, battery_level, confidence, recorded_at_str):
    payload_data = {
        'shipmentId': shipment_id,
        'temperature': float(temperature),
        'humidity': int(humidity),
        'vibration': float(vibration) if vibration is not None else None,
        'batteryLevel': int(battery_level) if battery_level is not None else None,
        'confidence': str(confidence),
        'recordedAt': recorded_at_str,
    }
    return hashlib.sha256(json.dumps(payload_data, sort_keys=True).encode()).hexdigest()


class HealthLiveView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'status': 'ok'})


class HealthReadyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        checks = {}
        # 1. Check Postgres DB
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            checks['database'] = 'ok'
        except Exception:
            checks['database'] = 'failed'
            return Response(
                {'error': 'SERVICE_UNAVAILABLE', 'message': 'Database connection failed', 'checks': checks},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        # 2. Check Redis / Channel Layer
        redis_url = getattr(settings, 'REDIS_URL', None) or 'redis://localhost:6379/0'
        try:
            r = redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
            r.ping()
            checks['redis'] = 'ok'
        except Exception:
            checks['redis'] = 'failed'
            return Response(
                {'error': 'SERVICE_UNAVAILABLE', 'message': 'Redis connection failed', 'checks': checks},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response({'status': 'ok', 'checks': checks})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'BAD_REQUEST', 'message': 'Email and password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.prefetch_related('memberships__tenant').get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'UNAUTHORIZED', 'message': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password):
            return Response(
                {'error': 'UNAUTHORIZED', 'message': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {'error': 'UNAUTHORIZED', 'message': 'User account is deactivated'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        first_membership = user.memberships.first()
        tenant_id = first_membership.tenant_id if first_membership else None

        token = generate_jwt_token(user, tenant_id=tenant_id)
        serializer = UserAuthContextSerializer(user, context={'active_tenant_id': tenant_id})

        response_data = serializer.data
        response_data['token'] = token
        return Response(response_data, status=status.HTTP_200_OK)



class AuthMeView(APIView):
    def get(self, request):
        active_tenant = getattr(request, 'active_tenant_id', None)
        serializer = UserAuthContextSerializer(request.user, context={'active_tenant_id': active_tenant})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TenantsListView(APIView):
    def get(self, request):
        memberships = request.user.memberships.select_related('tenant').all()
        serializer = TenantMembershipSerializer(memberships, many=True)
        return Response({'data': serializer.data}, status=status.HTTP_200_OK)


class ShipmentListView(APIView):
    def get(self, request, tenantId):
        membership = get_user_tenant_membership(request.user, tenantId)
        if not membership:
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Tenant not found or access denied'})

        queryset = Shipment.objects.filter(tenant_id=tenantId)

        # Filters
        shipment_status = request.query_params.get('status')
        if shipment_status:
            queryset = queryset.filter(status=shipment_status)

        compliance_status = request.query_params.get('compliance_status')
        if compliance_status:
            queryset = queryset.filter(compliance_status=compliance_status)

        warehouse = request.query_params.get('warehouse')
        if warehouse:
            queryset = queryset.filter(warehouse=warehouse)

        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(shipment_id__icontains=search) |
                Q(tracking_reference__icontains=search) |
                Q(cargo_type__icontains=search) |
                Q(origin__icontains=search) |
                Q(destination__icontains=search) |
                Q(warehouse__icontains=search)
            )

        ordering = request.query_params.get('ordering', '-last_updated')
        if ordering in ['last_updated', '-last_updated']:
            queryset = queryset.order_by(ordering)

        paginator = StandardPageNumberPagination()
        page_results = paginator.paginate_queryset(queryset, request)
        serializer = ShipmentSerializer(page_results, many=True)
        return paginator.get_paginated_response(serializer.data)


class ShipmentDetailView(APIView):
    def get(self, request, shipmentId):
        try:
            shipment = Shipment.objects.get(shipment_id=shipmentId)
        except Shipment.DoesNotExist:
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        # Cross-tenant check (Invariant: returns 404 for alien tenant)
        if not get_user_tenant_membership(request.user, shipment.tenant_id):
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        serializer = ShipmentSerializer(shipment)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ShipmentLatestSensorView(APIView):
    def get(self, request, shipmentId):
        try:
            shipment = Shipment.objects.get(shipment_id=shipmentId)
        except Shipment.DoesNotExist:
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        if not get_user_tenant_membership(request.user, shipment.tenant_id):
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        latest_reading = shipment.sensor_readings.order_by('-recorded_at').first()
        if not latest_reading:
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = SensorReadingSerializer(latest_reading)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ShipmentSensorHistoryView(APIView):
    def get(self, request, shipmentId):
        try:
            shipment = Shipment.objects.get(shipment_id=shipmentId)
        except Shipment.DoesNotExist:
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        if not get_user_tenant_membership(request.user, shipment.tenant_id):
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        try:
            limit = int(request.query_params.get('limit', 50))
            limit = max(1, min(limit, 200))
        except ValueError:
            limit = 50

        readings = shipment.sensor_readings.order_by('recorded_at')[:limit]
        serializer = SensorReadingSerializer(readings, many=True)
        return Response({'data': serializer.data}, status=status.HTTP_200_OK)


class ComplianceApproveView(APIView):
    def post(self, request, shipmentId):
        # 1. Fetch shipment
        try:
            shipment = Shipment.objects.get(shipment_id=shipmentId)
        except Shipment.DoesNotExist:
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        # 2. Cross-tenant check (returns 404 for alien tenant)
        tenant_id = shipment.tenant_id
        if not get_user_tenant_membership(request.user, tenant_id):
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        # 3. Permission check (requires compliance:approve)
        if not has_tenant_permission(request.user, tenant_id, 'compliance:approve'):
            raise PermissionDenied({'error': 'FORBIDDEN', 'message': 'User lacks compliance:approve permission'})

        # 4. Reason validation
        reason = request.data.get('reason', '').strip()
        if not reason or len(reason) < 10 or len(reason) > 1000:
            return Response(
                {'error': 'BAD_REQUEST', 'message': 'Reason must be between 10 and 1000 characters'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 5. Atomic lock & state check using select_for_update()
        with transaction.atomic():
            shipment_locked = Shipment.objects.select_for_update().get(shipment_id=shipmentId)

            if shipment_locked.compliance_status != ComplianceStatus.PENDING or shipment_locked.locked_at is not None:
                return Response(
                    {'error': 'CONFLICT', 'message': 'Shipment is already approved, rejected, or locked'},
                    status=status.HTTP_409_CONFLICT
                )

            now_dt = django_timezone.now()
            shipment_locked.compliance_status = ComplianceStatus.APPROVED
            shipment_locked.locked_at = now_dt
            shipment_locked.approved_by = request.user
            shipment_locked.last_updated = now_dt
            shipment_locked.save()

            # Create AuditEntry
            AuditEntry.objects.create(
                audit_id=f"audit-{shipmentId}-{uuid.uuid4().hex[:6]}",
                tenant_id=tenant_id,
                entity='shipment',
                entity_id=shipmentId,
                field='complianceStatus',
                before='PENDING',
                after='APPROVED',
                actor_user=request.user,
                reason=reason,
                timestamp=now_dt
            )

            AuditEntry.objects.create(
                audit_id=f"audit-{shipmentId}-{uuid.uuid4().hex[:6]}-lock",
                tenant_id=tenant_id,
                entity='shipment',
                entity_id=shipmentId,
                field='lockedAt',
                before=None,
                after=now_dt.isoformat(),
                actor_user=request.user,
                reason='Compliance decision locked.',
                timestamp=now_dt
            )

        serializer = ShipmentSerializer(shipment_locked)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ComplianceReportView(APIView):
    def get(self, request, shipmentId):
        try:
            shipment = Shipment.objects.get(shipment_id=shipmentId)
        except Shipment.DoesNotExist:
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        if not get_user_tenant_membership(request.user, shipment.tenant_id):
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        readings = list(shipment.sensor_readings.order_by('recorded_at'))
        latest = readings[-1] if readings else None

        has_temp_excursion = any(
            r.temperature < shipment.required_temperature_min or r.temperature > shipment.required_temperature_max
            for r in readings
        )
        has_hum_excursion = any(
            r.humidity < shipment.required_humidity_min or r.humidity > shipment.required_humidity_max
            for r in readings
        )

        report_data = {
            'shipmentId': shipment.shipment_id,
            'complianceStatus': shipment.compliance_status,
            'latestReading': latest,
            'sensorEventCount': len(readings),
            'hasTemperatureExcursion': has_temp_excursion,
            'hasHumidityExcursion': has_hum_excursion,
            'generatedAt': django_timezone.now()
        }

        serializer = ComplianceReportSerializer(report_data)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AuditLogsView(APIView):
    def get(self, request):
        entity = request.query_params.get('entity')
        entity_id = request.query_params.get('entityId')

        if not entity or not entity_id:
            return Response(
                {'error': 'BAD_REQUEST', 'message': 'entity and entityId query parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if entity != 'shipment':
            return Response(
                {'error': 'BAD_REQUEST', 'message': 'Only entity=shipment is supported'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            shipment = Shipment.objects.get(shipment_id=entity_id)
        except Shipment.DoesNotExist:
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        tenant_id = shipment.tenant_id
        if not get_user_tenant_membership(request.user, tenant_id):
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        if not has_tenant_permission(request.user, tenant_id, 'audit-logs:read'):
            raise PermissionDenied({'error': 'FORBIDDEN', 'message': 'User lacks audit-logs:read permission'})

        audit_entries = AuditEntry.objects.filter(entity=entity, entity_id=entity_id).order_by('-timestamp')
        serializer = AuditEntrySerializer(audit_entries, many=True)
        return Response({'data': serializer.data}, status=status.HTTP_200_OK)


class StreamTicketView(APIView):
    def post(self, request):
        tenant_id = request.data.get('tenantId')
        if not tenant_id:
            return Response(
                {'error': 'BAD_REQUEST', 'message': 'tenantId is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not get_user_tenant_membership(request.user, tenant_id):
            raise PermissionDenied({'error': 'FORBIDDEN', 'message': 'User does not belong to specified tenant'})

        if not has_tenant_permission(request.user, tenant_id, 'sensor-stream:read'):
            raise PermissionDenied({'error': 'FORBIDDEN', 'message': 'User lacks sensor-stream:read permission'})

        raw_ticket = f"stk_{uuid.uuid4().hex}{uuid.uuid4().hex}"
        ticket_hash = hashlib.sha256(raw_ticket.encode()).hexdigest()
        expires_at = django_timezone.now() + timedelta(minutes=5)

        StreamTicket.objects.create(
            ticket_hash=ticket_hash,
            tenant_id=tenant_id,
            user=request.user,
            expires_at=expires_at
        )

        ws_url = f"ws://localhost:8080/ws/v1/sensor-data?ticket={raw_ticket}"

        return Response({
            'ticket': raw_ticket,
            'expiresAt': expires_at.isoformat(),
            'websocketUrl': ws_url
        }, status=status.HTTP_201_CREATED)


class TelemetryIngestionView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        device_key = request.headers.get('X-Device-Key')
        idempotency_key = request.headers.get('Idempotency-Key')

        if not device_key or not idempotency_key:
            return Response(
                {'error': 'BAD_REQUEST', 'message': 'X-Device-Key and Idempotency-Key headers are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Device key lookup
        try:
            device = Device.objects.select_related('tenant').get(device_key=device_key)
        except Device.DoesNotExist:
            return Response(
                {'error': 'UNAUTHORIZED', 'message': 'Invalid device key'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 2. Strict Schema Validation with TelemetryInputSerializer
        serializer = TelemetryInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'BAD_REQUEST', 'message': 'Invalid telemetry input', 'details': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        validated_data = serializer.validated_data
        event_id = validated_data['eventId']
        shipment_id = validated_data['shipmentId']

        # 3. Rule: eventId and Idempotency-Key must match
        if event_id != idempotency_key:
            return Response(
                {'error': 'BAD_REQUEST', 'message': 'eventId and Idempotency-Key header must match'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. Rule: Shipment must belong to device's tenant
        try:
            shipment = Shipment.objects.get(shipment_id=shipment_id, tenant_id=device.tenant_id)
        except Shipment.DoesNotExist:
            raise NotFound({'error': 'NOT_FOUND', 'message': 'Shipment not found'})

        # Hash payload for idempotency check including shipmentId
        recorded_at = validated_data['recordedAt']
        recorded_at_iso = recorded_at.isoformat()
        payload_hash = compute_telemetry_hash(
            shipment_id=shipment_id,
            temperature=validated_data['temperature'],
            humidity=validated_data['humidity'],
            vibration=validated_data.get('vibration'),
            battery_level=validated_data.get('batteryLevel'),
            confidence=validated_data['confidence'],
            recorded_at_str=recorded_at_iso
        )

        # 5. Check for existing event ID
        existing_reading = SensorReading.objects.filter(event_id=event_id).first()
        if existing_reading:
            # Check 1: Shipment must match
            if existing_reading.shipment_id != shipment_id:
                return Response(
                    {'error': 'EVENT_CONFLICT', 'message': 'Event identifier reused with a conflicting shipment'},
                    status=status.HTTP_409_CONFLICT
                )

            # Check 2: Payload hash must match exactly
            existing_hash = existing_reading.payload_hash
            if not existing_hash:
                existing_hash = compute_telemetry_hash(
                    shipment_id=existing_reading.shipment_id,
                    temperature=existing_reading.temperature,
                    humidity=existing_reading.humidity,
                    vibration=existing_reading.vibration,
                    battery_level=existing_reading.battery_level,
                    confidence=existing_reading.confidence,
                    recorded_at_str=existing_reading.recorded_at.isoformat()
                )

            if existing_hash == payload_hash:
                return Response({
                    'eventId': event_id,
                    'accepted': True,
                    'replayed': True
                }, status=status.HTTP_200_OK)
            else:
                return Response(
                    {'error': 'EVENT_CONFLICT', 'message': 'Event identifier reused with a conflicting payload'},
                    status=status.HTTP_409_CONFLICT
                )

        # 6. Persist event inside transaction & publish on commit
        with transaction.atomic():
            reading = SensorReading.objects.create(
                event_id=event_id,
                shipment=shipment,
                temperature=validated_data['temperature'],
                humidity=validated_data['humidity'],
                vibration=validated_data.get('vibration'),
                battery_level=validated_data.get('batteryLevel'),
                confidence=validated_data['confidence'],
                recorded_at=recorded_at,
                payload_hash=payload_hash
            )

            if recorded_at > shipment.last_updated:
                shipment.last_updated = recorded_at
                shipment.save()

            # Schedule WebSockets Redis publish ONLY AFTER transaction commit!
            event_payload = {
                'eventId': event_id,
                'type': 'sensor.reading.created',
                'tenantId': device.tenant_id,
                'shipmentId': shipment_id,
                'recordedAt': recorded_at.isoformat(),
                'publishedAt': django_timezone.now().isoformat(),
                'payload': {
                    'temperature': reading.temperature,
                    'humidity': reading.humidity,
                    'vibration': reading.vibration,
                    'batteryLevel': reading.battery_level,
                    'confidence': reading.confidence,
                }
            }

            channel_layer = get_channel_layer()
            tenant_group = f"tenant_{device.tenant_id}"

            def publish_ws_event():
                async_to_sync(channel_layer.group_send)(
                    tenant_group,
                    {
                        'type': 'sensor_event',
                        'data': event_payload
                    }
                )

            transaction.on_commit(publish_ws_event)

        return Response({
            'eventId': event_id,
            'accepted': True,
            'replayed': False
        }, status=status.HTTP_202_ACCEPTED)

