"""
Multi-Tenant Configuration Models for Synapse Clinical v4.1.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class TenantConfig(BaseModel):
    tenant_id: str = Field(..., description="Unique identifier for the healthcare organization")
    name: str = Field(..., description="Healthcare institution or hospital system name")
    domains: List[str] = Field(default_factory=list, description="Allowed domains for widget embedding and CORS")
    logo_url: Optional[str] = None
    primary_color: str = Field(default="#0EA5E9", description="Brand theme color in hex")
    default_language: str = Field(default="en", description="Default initial language: 'en' or 'bn'")
    supported_languages: List[str] = Field(default_factory=lambda: ["en", "bn"])
    emergency_phone: str = Field(default="911", description="Emergency contact number (e.g. 911 for US, 999 for BD)")
    emergency_message_en: str = Field(
        default="If you are experiencing severe chest pain, shortness of breath, or a life-threatening emergency, call 911 or proceed to the nearest emergency department immediately."
    )
    emergency_message_bn: str = Field(
        default="যদি আপনার তীব্র বুকে ব্যথা, শ্বাসকষ্ট বা জীবনহানিকর কোনো জরুরি অবস্থা থাকে, তবে অবিলম্বে ৯৯৯ নম্বরে ফোন করুন অথবা নিকটস্থ জরুরি বিভাগে যোগাযোগ করুন।"
    )
    welcome_message_en: str = Field(
        default="Hello! I am your Synapse Patient Health Assistant. How can I help you with health education, medication safety, or clinic appointments today?"
    )
    welcome_message_bn: str = Field(
        default="নমস্কার / আসসালামু আলাইকুম! আমি মেডপালস স্বাস্থ্য সহকারী। স্বাস্থ্য সচেতনতা, ওষুধের তথ্য অথবা চিকিৎসকের অ্যাপয়েন্টমেন্ট বিষয়ে আমি কীভাবে আপনাকে সাহায্য করতে পারি?"
    )
    handoff_enabled: bool = Field(default=True, description="Whether human clinical support escalation queue is enabled")
    organization_address: str = Field(default="Clinical Medical Center")
    created_at: str = Field(default="2026-11-20 00:00:00")
