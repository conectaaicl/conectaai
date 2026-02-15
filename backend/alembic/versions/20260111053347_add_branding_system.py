"""add branding system

Revision ID: brand_final
Revises: 383d15786f72
Create Date: 2026-01-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision = 'brand_final'
down_revision = '383d15786f72'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'company_branding',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('company_id', sa.Integer, sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('brand_name', sa.String(100), nullable=False),
        sa.Column('logo_url', sa.String(500)),
        sa.Column('favicon_url', sa.String(500)),
        sa.Column('primary_color', sa.String(7), server_default='#2563eb'),
        sa.Column('secondary_color', sa.String(7), server_default='#7c3aed'),
        sa.Column('accent_color', sa.String(7), server_default='#ec4899'),
        sa.Column('subdomain', sa.String(50), unique=True),
        sa.Column('custom_domain', sa.String(100), unique=True),
        sa.Column('support_email', sa.String(100)),
        sa.Column('support_phone', sa.String(20)),
        sa.Column('features', JSONB, server_default='{}'),
        sa.Column('smtp_config', JSONB, server_default='{}'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now())
    )
    
    op.create_index('idx_company_branding_subdomain', 'company_branding', ['subdomain'])
    op.create_index('idx_company_branding_custom_domain', 'company_branding', ['custom_domain'])
    op.create_index('idx_company_branding_company_id', 'company_branding', ['company_id'])

def downgrade():
    op.drop_index('idx_company_branding_company_id')
    op.drop_index('idx_company_branding_custom_domain')
    op.drop_index('idx_company_branding_subdomain')
    op.drop_table('company_branding')
