from rest_framework.permissions import BasePermission
from core.models import TenantMembership, ROLE_PERMISSIONS

def get_user_tenant_membership(user, tenant_id):
    if not user or not user.is_authenticated or not tenant_id:
        return None
    try:
        return TenantMembership.objects.select_related('tenant').get(user=user, tenant_id=tenant_id)
    except TenantMembership.DoesNotExist:
        return None

def has_tenant_permission(user, tenant_id, required_permission):
    membership = get_user_tenant_membership(user, tenant_id)
    if not membership:
        return False
    user_permissions = ROLE_PERMISSIONS.get(membership.role, [])
    return required_permission in user_permissions

class HasTenantPermission(BasePermission):
    """
    Custom permission to check if user has access to a specific tenant and permission.
    """
    def __init__(self, required_permission=None):
        self.required_permission = required_permission

    def __call__(self):
        return self

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        tenant_id = view.kwargs.get('tenantId') or getattr(request, 'active_tenant_id', None)
        if not tenant_id:
            return True
        if self.required_permission:
            return has_tenant_permission(request.user, tenant_id, self.required_permission)
        return get_user_tenant_membership(request.user, tenant_id) is not None
