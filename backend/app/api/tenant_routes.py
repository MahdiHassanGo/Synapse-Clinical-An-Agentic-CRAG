"""
Tenant Management API Endpoints for Synapse Clinical v4.1.
"""
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Body

from app.tenants.models import TenantConfig
from app.tenants.manager import tenant_manager

router = APIRouter(prefix="/api/v1/tenants", tags=["Tenant Management"])


@router.get("")
def list_tenants():
    """Lists all configured healthcare tenants and clinics."""
    tenants = tenant_manager.list_tenants()
    return {
        "count": len(tenants),
        "tenants": [t.model_dump() for t in tenants]
    }


@router.get("/{tenant_id}")
def get_tenant(tenant_id: str):
    """Retrieves configuration and branding for a specific tenant."""
    tenant = tenant_manager.get_tenant(tenant_id)
    return tenant.model_dump()


@router.post("")
def create_tenant(payload: TenantConfig):
    """Creates a new healthcare institution tenant."""
    try:
        tenant = tenant_manager.create_tenant(payload.model_dump())
        return tenant.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{tenant_id}")
def update_tenant(tenant_id: str, payload: dict = Body(...)):
    """Updates tenant settings, domains, or emergency numbers."""
    try:
        tenant = tenant_manager.update_tenant(tenant_id, payload)
        return tenant.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
