"""
Tenant Manager for Synapse Clinical v4.1 Multi-Tenant Hospital & Clinic Architecture.
Provides isolation, domain allowlisting, localized emergency hotlines, and clinic branding.
"""
import time
import threading
from typing import Dict, List, Optional
from urllib.parse import urlparse

from app.tenants.models import TenantConfig


class TenantManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._tenants: Dict[str, TenantConfig] = {}
        self._init_default_tenants()

    def _init_default_tenants(self):
        default_hospital = TenantConfig(
            tenant_id="DEFAULT_HOSPITAL",
            name="Synapse University Hospital",
            domains=["*", "localhost", "127.0.0.1", "synapse.health"],
            logo_url="/logo.png",
            primary_color="#0EA5E9",
            default_language="en",
            supported_languages=["en", "bn"],
            emergency_phone="911",
            emergency_message_en="If you have severe chest pain, breathing difficulty, or a life-threatening emergency, call 911 immediately or visit the nearest ER.",
            emergency_message_bn="জরুরি অবস্থায় অবিলম্বে ৯১১ অথবা নিকটস্থ জরুরি বিভাগে যোগাযোগ করুন।",
            welcome_message_en="Welcome to Synapse University Hospital. I am your virtual health navigator. How may I assist you today?",
            welcome_message_bn="মেডপালস জেনারেল হাসপাতালে আপনাকে স্বাগতম। আপনার স্বাস্থ্য বিষয়ক যেকোনো তথ্যের জন্য আমি উপস্থিত আছি।",
            handoff_enabled=True,
            organization_address="742 Evergreen Terrace, Medical District, NY",
            created_at="2026-11-20 00:00:00"
        )
        dhaka_clinic = TenantConfig(
            tenant_id="CLINIC_DHAKA",
            name="Dhaka Metropolitan Health Center",
            domains=["*", "localhost", "127.0.0.1", "dhakahealth.gov.bd"],
            logo_url="/dhaka-logo.png",
            primary_color="#10B981",
            default_language="bn",
            supported_languages=["bn", "en"],
            emergency_phone="999",
            emergency_message_en="For acute medical emergencies in Bangladesh, immediately dial 999 or go to the nearest hospital casualty department.",
            emergency_message_bn="জরুরি চিকিৎসা প্রয়োজনে অবিলম্বে জাতীয় জরুরি সেবা ৯৯৯ নম্বরে ফোন করুন অথবা নিকটস্থ হাসপাতালের জরুরি বিভাগে যোগাযোগ করুন।",
            welcome_message_en="Welcome to Dhaka Metropolitan Health Center. How can we help you with clinic guidance, appointment routing, or health questions today?",
            welcome_message_bn="ঢাকা মেট্রোপলিটন হেলথ সেন্টারে আপনাকে স্বাগতম। সাধারণ স্বাস্থ্য পরামর্শ, চিকিৎসকের অ্যাপয়েন্টমেন্ট বা ওষুধের তথ্যের জন্য জিজ্ঞাসা করুন।",
            handoff_enabled=True,
            organization_address="House 42, Road 7/A, Dhanmondi, Dhaka 1209, Bangladesh",
            created_at="2026-11-20 00:00:00"
        )
        self._tenants["DEFAULT_HOSPITAL"] = default_hospital
        self._tenants["CLINIC_DHAKA"] = dhaka_clinic

    def get_tenant(self, tenant_id: Optional[str]) -> TenantConfig:
        if not tenant_id:
            return self._tenants["DEFAULT_HOSPITAL"]
        with self._lock:
            return self._tenants.get(tenant_id, self._tenants["DEFAULT_HOSPITAL"])

    def list_tenants(self) -> List[TenantConfig]:
        with self._lock:
            return list(self._tenants.values())

    def create_tenant(self, data: dict) -> TenantConfig:
        with self._lock:
            tenant_id = data.get("tenant_id")
            if not tenant_id:
                raise ValueError("tenant_id is required")
            if tenant_id in self._tenants:
                raise ValueError(f"Tenant '{tenant_id}' already exists")
            
            tenant = TenantConfig(**data)
            self._tenants[tenant_id] = tenant
            return tenant

    def update_tenant(self, tenant_id: str, data: dict) -> TenantConfig:
        with self._lock:
            existing = self._tenants.get(tenant_id)
            if not existing:
                raise ValueError(f"Tenant '{tenant_id}' not found")
            
            updated_dict = existing.model_dump()
            for k, v in data.items():
                if v is not None and k in updated_dict:
                    updated_dict[k] = v
            
            updated_tenant = TenantConfig(**updated_dict)
            self._tenants[tenant_id] = updated_tenant
            return updated_tenant

    def verify_origin(self, tenant_id: str, origin: str) -> bool:
        """Verifies if an HTTP origin or referrer is authorized to embed this tenant's chat widget."""
        tenant = self.get_tenant(tenant_id)
        if "*" in tenant.domains:
            return True
        if not origin:
            return False
        
        parsed = urlparse(origin)
        host = parsed.netloc.split(":")[0].lower()
        for d in tenant.domains:
            if d.lower() == host or host.endswith("." + d.lower()):
                return True
        return False


tenant_manager = TenantManager()
