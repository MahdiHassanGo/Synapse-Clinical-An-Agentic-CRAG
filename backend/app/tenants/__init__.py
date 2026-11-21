"""
Tenants package for Synapse Clinical v4.1 Multi-Tenant Hospital & Clinic Architecture.
"""
from app.tenants.models import TenantConfig
from app.tenants.manager import tenant_manager

__all__ = ["TenantConfig", "tenant_manager"]
