import json
from django.test import TestCase
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework import status
from core.models import User, Shipment, Tenant, Device, SensorReading, ComplianceStatus, Role, TenantMembership
from core.authentication import generate_jwt_token


class AtlasLogixAPITestCase(TestCase):
    def setUp(self):
        call_command('import_seed')
        self.client = APIClient()

        # Seed Users
        self.admin_user = User.objects.get(user_id='user-REDA-HAFEZ-admin')
        self.auditor_user = User.objects.get(user_id='user-REDA-HAFEZ-auditor')
        self.ops_user = User.objects.get(user_id='user-REDA-HAFEZ-operations')
        self.warehouse_user = User.objects.get(user_id='user-REDA-HAFEZ-warehouse')
        self.viewer_user = User.objects.get(user_id='user-REDA-HAFEZ-viewer')

        self.primary_tenant = Tenant.objects.get(tenant_id='TENANT-REDA-HAFEZ')
        self.mena_tenant = Tenant.objects.get(tenant_id='TENANT-REDA-HAFEZ-MENA')

    def get_auth_client(self, user, tenant_id='TENANT-REDA-HAFEZ'):
        client = APIClient()
        token = generate_jwt_token(user, tenant_id=tenant_id)
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return client

    def test_health_endpoints(self):
        res = self.client.get('/health/live')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'ok')

        res = self.client.get('/health/ready')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], 'ok')

    def test_login_success_and_failure(self):
        # Valid login
        res = self.client.post('/api/v1/auth/login', {
            'email': 'admin.reda-hafez@atlaslogix.test',
            'password': '7P1OhjscS32sQjYWFCra2w'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('token', res.data)
        self.assertEqual(res.data['email'], 'admin.reda-hafez@atlaslogix.test')

        # Invalid login
        res = self.client.post('/api/v1/auth/login', {
            'email': 'admin.reda-hafez@atlaslogix.test',
            'password': 'WrongPassword123'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_tenant_isolation_returns_404(self):
        # Create a single-tenant user with membership ONLY in primary_tenant
        isolated_user = User.objects.create(
            user_id='user-isolated-test',
            email='isolated.auditor@atlaslogix.test'
        )
        TenantMembership.objects.create(
            user=isolated_user,
            tenant=self.primary_tenant,
            role='COMPLIANCE_AUDITOR'
        )

        client = self.get_auth_client(isolated_user, tenant_id='TENANT-REDA-HAFEZ')

        # Detail fetch for alien shipment (MENA-30481) -> must return 404 Not Found
        res = client.get('/api/v1/shipments/MENA-30481')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(res.data['error'], 'NOT_FOUND')

        # Sensor data fetch for alien shipment -> must return 404 Not Found
        res = client.get('/api/v1/shipments/MENA-30481/sensor-data')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_shipment_no_sensor_readings(self):
        # ALX-20468 has no sensor readings
        client = self.get_auth_client(self.auditor_user)

        res = client.get('/api/v1/shipments/ALX-20468/sensor-data')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)

        res = client.get('/api/v1/shipments/ALX-20468/sensor-data/history')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['data'], [])

    def test_compliance_approval_role_and_locking(self):
        # ALX-20481 is PENDING and unlocked
        # 1. Non-auditor (operations manager) attempts approval -> 403 Forbidden
        ops_client = self.get_auth_client(self.ops_user)
        res = ops_client.post('/api/v1/shipments/ALX-20481/compliance/approve', {
            'reason': 'Verified temperature excursion as acceptable.'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # 2. Auditor approves with valid reason -> 200 OK
        auditor_client = self.get_auth_client(self.auditor_user)
        res = auditor_client.post('/api/v1/shipments/ALX-20481/compliance/approve', {
            'reason': 'Excursion accepted after expert QA investigation.'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['complianceStatus'], 'APPROVED')

        # 3. Repeated approval on locked shipment -> 409 Conflict
        res = auditor_client.post('/api/v1/shipments/ALX-20481/compliance/approve', {
            'reason': 'Attempting second approval.'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data['error'], 'CONFLICT')

    def test_telemetry_idempotency_and_conflict(self):
        device = Device.objects.get(device_id='device-REDA-HAFEZ-primary')
        event_id = 'evt-test-unique-1001'

        payload = {
            'eventId': event_id,
            'shipmentId': 'ALX-20481',
            'temperature': 5.5,
            'humidity': 45,
            'vibration': 0.05,
            'batteryLevel': 95,
            'confidence': 'HIGH',
            'recordedAt': '2026-07-12T15:00:00Z'
        }

        # 1. First acceptance -> 202 Accepted
        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=event_id
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(res.data['accepted'])
        self.assertFalse(res.data['replayed'])

        # 2. Replay identical payload -> 200 OK (replayed: true)
        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=event_id
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['accepted'])
        self.assertTrue(res.data['replayed'])

        # 3. Reuse event ID with conflicting payload -> 409 Conflict
        conflicting_payload = dict(payload)
        conflicting_payload['temperature'] = 19.9

        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=conflicting_payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=event_id
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data['error'], 'EVENT_CONFLICT')

    def test_telemetry_altered_shipment_rejected_with_conflict_409(self):
        # Issue 1: Changing shipment ID on a replayed event must return 409 EVENT_CONFLICT
        device = Device.objects.get(device_id='device-REDA-HAFEZ-primary')
        event_id = 'evt-test-altered-shipment-1002'

        payload = {
            'eventId': event_id,
            'shipmentId': 'ALX-20481',
            'temperature': 4.2,
            'humidity': 50,
            'vibration': 0.01,
            'batteryLevel': 90,
            'confidence': 'HIGH',
            'recordedAt': '2026-07-12T16:00:00Z'
        }

        # 1. Initial ingestion -> 202
        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=event_id
        )
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)

        # 2. Resend with different shipment ID (ALX-20477) -> 409 Conflict
        altered_payload = dict(payload)
        altered_payload['shipmentId'] = 'ALX-20477'

        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=altered_payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=event_id
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data['error'], 'EVENT_CONFLICT')

    def test_telemetry_fixture_modified_reading_rejected_with_conflict_409(self):
        # Issue 2: Modifying values for a pre-seeded fixture event ID must return 409 EVENT_CONFLICT
        device = Device.objects.get(device_id='device-REDA-HAFEZ-primary')
        fixture_reading = SensorReading.objects.first()
        self.assertIsNotNone(fixture_reading)

        conflicting_payload = {
            'eventId': fixture_reading.event_id,
            'shipmentId': fixture_reading.shipment_id,
            'temperature': -999.0,
            'humidity': 50,
            'vibration': 0.02,
            'batteryLevel': 80,
            'confidence': 'HIGH',
            'recordedAt': fixture_reading.recorded_at.isoformat()
        }

        res = self.client.post(
            '/api/v1/telemetry/readings',
            data=conflicting_payload,
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY=fixture_reading.event_id
        )
        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res.data['error'], 'EVENT_CONFLICT')

    def test_telemetry_validation_failures_return_400(self):
        # Issue 3: Strict validation against schema (missing fields, invalid enum, bad date)
        device = Device.objects.get(device_id='device-REDA-HAFEZ-primary')

        # 1. Missing sensor readings (only eventId and shipmentId)
        res = self.client.post(
            '/api/v1/telemetry/readings',
            data={'eventId': 'evt-val-1', 'shipmentId': 'ALX-20481'},
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY='evt-val-1'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error'], 'BAD_REQUEST')

        # 2. Confidence set to INVALID
        res = self.client.post(
            '/api/v1/telemetry/readings',
            data={
                'eventId': 'evt-val-2',
                'shipmentId': 'ALX-20481',
                'temperature': 5.0,
                'humidity': 50,
                'confidence': 'INVALID',
                'recordedAt': '2026-07-12T17:00:00Z'
            },
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY='evt-val-2'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error'], 'BAD_REQUEST')

        # 3. recordedAt set to not-a-date -> must return 400 Bad Request, NOT 500
        res = self.client.post(
            '/api/v1/telemetry/readings',
            data={
                'eventId': 'evt-val-3',
                'shipmentId': 'ALX-20481',
                'temperature': 5.0,
                'humidity': 50,
                'confidence': 'HIGH',
                'recordedAt': 'not-a-date'
            },
            format='json',
            HTTP_X_DEVICE_KEY=device.device_key,
            HTTP_IDEMPOTENCY_KEY='evt-val-3'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(res.data['error'], 'BAD_REQUEST')

    def test_disabled_user_cannot_login_or_use_jwt(self):
        # Issue 4: Deactivated account cannot authenticate via password or existing JWT
        client = self.get_auth_client(self.auditor_user)

        # Deactivate user
        self.auditor_user.is_active = False
        self.auditor_user.save()

        # 1. Login attempt with valid password -> 401 Unauthorized
        res = self.client.post('/api/v1/auth/login', {
            'email': 'auditor.reda-hafez@atlaslogix.test',
            'password': '4wLJerbLyBGBGZG8t8IIjA'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data['error'], 'UNAUTHORIZED')

        # 2. Request /api/v1/auth/me with previously generated token -> 401 Unauthorized
        res = client.get('/api/v1/auth/me')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res.data['error'], 'UNAUTHORIZED')

    def test_reimport_seed_preserves_approval_lock(self):
        # Issue 5: Container restart / reimporting fixture must preserve auditor approval decisions
        auditor_client = self.get_auth_client(self.auditor_user)

        # Approve shipment ALX-20481
        res = auditor_client.post('/api/v1/shipments/ALX-20481/compliance/approve', {
            'reason': 'Approved under strict laboratory supervision.'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['complianceStatus'], 'APPROVED')

        # Re-run seed import command (simulating container restart)
        call_command('import_seed')

        # Verify shipment in DB is still APPROVED and locked
        shipment = Shipment.objects.get(shipment_id='ALX-20481')
        self.assertEqual(shipment.compliance_status, ComplianceStatus.APPROVED)
        self.assertIsNotNone(shipment.locked_at)
        self.assertEqual(shipment.approved_by, self.auditor_user)

    def test_health_ready_returns_503_when_redis_fails(self):
        # Issue 6: When Redis ping fails, /health/ready returns 503 Service Unavailable
        from unittest.mock import patch
        import redis

        with patch.object(redis.Redis, 'ping', side_effect=redis.ConnectionError("Redis connection refused")):
            res = self.client.get('/health/ready')
            self.assertEqual(res.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertEqual(res.data['error'], 'SERVICE_UNAVAILABLE')
            self.assertEqual(res.data['checks']['redis'], 'failed')

    def test_stream_ticket_issuance(self):
        client = self.get_auth_client(self.auditor_user)

        res = client.post('/api/v1/stream/tickets', {
            'tenantId': 'TENANT-REDA-HAFEZ'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('ticket', res.data)
        self.assertIn('websocketUrl', res.data)
        self.assertTrue(res.data['ticket'].startswith('stk_'))

    def test_tenant_admin_can_list_users(self):
        admin_client = self.get_auth_client(self.admin_user)
        res = admin_client.get('/api/v1/tenants/TENANT-REDA-HAFEZ/users')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('data', res.data)
        self.assertGreaterEqual(res.data['count'], 5)
        first_user = res.data['data'][0]
        self.assertIn('userId', first_user)
        self.assertIn('email', first_user)
        self.assertIn('role', first_user)
        self.assertIn('permissions', first_user)

    def test_non_admin_cannot_manage_users(self):
        viewer_client = self.get_auth_client(self.viewer_user)
        res = viewer_client.get('/api/v1/tenants/TENANT-REDA-HAFEZ/users')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        res = viewer_client.post('/api/v1/tenants/TENANT-REDA-HAFEZ/users', {
            'email': 'unauthorized.user@atlaslogix.test',
            'role': 'VIEWER'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_admin_can_create_update_and_toggle_user(self):
        admin_client = self.get_auth_client(self.admin_user)

        # 1. Create new user
        res = admin_client.post('/api/v1/tenants/TENANT-REDA-HAFEZ/users', {
            'email': 'new.specialist@atlaslogix.test',
            'username': 'Tariq Specialist',
            'role': 'OPERATIONS_MANAGER',
            'password': 'InitialSecurePass123!',
            'isActive': True
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        new_user_id = res.data['data']['userId']
        self.assertEqual(res.data['data']['role'], 'OPERATIONS_MANAGER')

        # 2. Update user role and status
        res = admin_client.patch(f'/api/v1/tenants/TENANT-REDA-HAFEZ/users/{new_user_id}', {
            'role': 'WAREHOUSE_SUPERVISOR',
            'isActive': False
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['data']['role'], 'WAREHOUSE_SUPERVISOR')
        self.assertFalse(res.data['data']['isActive'])

        # Verify user cannot log in while inactive
        login_res = self.client.post('/api/v1/auth/login', {
            'email': 'new.specialist@atlaslogix.test',
            'password': 'InitialSecurePass123!'
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tenant_admin_can_reset_password(self):
        admin_client = self.get_auth_client(self.admin_user)

        # Create target user
        admin_client.post('/api/v1/tenants/TENANT-REDA-HAFEZ/users', {
            'email': 'reset.test@atlaslogix.test',
            'username': 'Reset Test',
            'role': 'VIEWER',
            'password': 'OldPassword123!'
        }, format='json')

        user = User.objects.get(email='reset.test@atlaslogix.test')

        # Admin resets password
        res = admin_client.post(f'/api/v1/tenants/TENANT-REDA-HAFEZ/users/{user.user_id}/reset-password', {
            'password': 'BrandNewPassword2026!'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # User logs in with new password
        login_res = self.client.post('/api/v1/auth/login', {
            'email': 'reset.test@atlaslogix.test',
            'password': 'BrandNewPassword2026!'
        }, format='json')
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertIn('token', login_res.data)


