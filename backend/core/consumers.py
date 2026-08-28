import hashlib
import json
import asyncio
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from channels.db import database_sync_to_async
from core.models import StreamTicket, ROLE_PERMISSIONS, TenantMembership


class SensorDataConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.tenant_id = None
        self.group_name = None
        self.user_id = None
        self.ping_task = None

    async def connect(self):
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        ticket_raw = params.get('ticket', [None])[0]

        if not ticket_raw:
            await self.close(code=4401)
            return

        ticket_data = await self.validate_and_consume_ticket(ticket_raw)

        if not ticket_data['valid']:
            await self.close(code=ticket_data['close_code'])
            return

        self.tenant_id = ticket_data['tenant_id']
        self.user_id = ticket_data['user_id']
        self.group_name = f"tenant_{self.tenant_id}"

        # Join tenant Redis group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

        # Send connection.ready event
        ready_payload = {
            "type": "connection.ready",
            "tenantId": self.tenant_id,
            "connectedAt": timezone.now().isoformat()
        }
        await self.send(text_data=json.dumps(ready_payload))

        # Start periodic 30s heartbeat
        self.ping_task = asyncio.create_task(self.heartbeat_loop())

    async def disconnect(self, close_code):
        if self.ping_task:
            self.ping_task.cancel()

        if self.group_name:
            await self.channel_layer.group_discard(
                self.group_name,
                self.channel_name
            )

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            try:
                data = json.loads(text_data)
                if data.get('type') == 'ping':
                    await self.send(text_data=json.dumps({"type": "pong", "timestamp": timezone.now().isoformat()}))
            except Exception:
                pass

    async def sensor_event(self, event):
        # Broadcast sensor event to client
        event_data = event['data']
        await self.send(text_data=json.dumps(event_data))

    async def heartbeat_loop(self):
        try:
            while True:
                await asyncio.sleep(25)
                ping_msg = {
                    "type": "heartbeat",
                    "timestamp": timezone.now().isoformat()
                }
                await self.send(text_data=json.dumps(ping_msg))
        except asyncio.CancelledError:
            pass

    @database_sync_to_async
    def validate_and_consume_ticket(self, ticket_raw):
        ticket_hash = hashlib.sha256(ticket_raw.encode()).hexdigest()
        now = timezone.now()

        try:
            ticket = StreamTicket.objects.select_related('user', 'tenant').get(ticket_hash=ticket_hash)
        except StreamTicket.DoesNotExist:
            return {'valid': False, 'close_code': 4401}

        if ticket.consumed_at is not None or ticket.expires_at <= now:
            return {'valid': False, 'close_code': 4401}

        # Check permission
        try:
            membership = TenantMembership.objects.get(user=ticket.user, tenant=ticket.tenant)
            permissions = ROLE_PERMISSIONS.get(membership.role, [])
            if 'sensor-stream:read' not in permissions:
                return {'valid': False, 'close_code': 4403}
        except TenantMembership.DoesNotExist:
            return {'valid': False, 'close_code': 4403}

        # Consume ticket atomically
        ticket.consumed_at = now
        ticket.save(update_fields=['consumed_at'])

        return {
            'valid': True,
            'tenant_id': ticket.tenant_id,
            'user_id': ticket.user.user_id,
            'close_code': None
        }
