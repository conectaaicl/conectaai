"""add company phone address status dates

Revision ID: [MANTÉN EL ID QUE SALIÓ]
Revises: brand_final
Create Date: [MANTÉN LA FECHA]

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '[MANTÉN EL ID]'
down_revision = 'brand_final'
branch_labels = None
depends_on = None


def upgrade():
    # Agregar columnas a companies si no existen
    op.execute("""
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS phone VARCHAR,
        ADD COLUMN IF NOT EXISTS address VARCHAR,
        ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    """)
    
    # Crear tabla payment_history
    op.create_table(
        'payment_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('subscription_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(3), server_default='USD'),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('invoice_url', sa.String(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ondelete='CASCADE')
    )
    
    # Agregar campos a subscriptions si no existen
    op.execute("""
        ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS activated_at TIMESTAMP DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
    """)


def downgrade():
    op.drop_table('payment_history')
    op.execute("""
        ALTER TABLE companies 
        DROP COLUMN IF EXISTS phone,
        DROP COLUMN IF EXISTS address,
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS created_at,
        DROP COLUMN IF EXISTS updated_at;
        
        ALTER TABLE subscriptions
        DROP COLUMN IF EXISTS activated_at,
        DROP COLUMN IF EXISTS suspended_at;
    """)
