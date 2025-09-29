#!/usr/bin/env python3
"""
Script de gerenciamento do Torres Project
Comandos disponíveis:
- create-admin: Criar usuário administrador
- reset-db: Resetar banco de dados
- seed-data: Popular com dados de exemplo
- cleanup-logs: Limpar logs antigos
- stats: Mostrar estatísticas do sistema
"""

import asyncio
import sys
import os
from datetime import datetime, timedelta
from typing import Optional

# Adicionar o diretório raiz do projeto ao sys.path (robusto para execução de qualquer pasta)
_THIS_DIR = os.path.dirname(__file__)              # app/scripts
_PROJECT_ROOT = os.path.abspath(os.path.join(_THIS_DIR, os.pardir, os.pardir))  # raiz
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from app.core.database import SessionLocal, engine, Base
from app.core.config import settings
from app.core.logging_config import configure_logging, get_logger
from app.models_schemas.models import User, QueryHistory, AuditLog
from app.services.main_service import UserService
from app.models_schemas.schemas import UserCreate

configure_logging()
logger = get_logger(__name__)


async def create_admin_user(email: str, password: str):
    """Criar usuário administrador"""
    async with SessionLocal() as db:
        try:
            # Verificar se já existe
            from sqlalchemy import select
            stmt = select(User).where(User.email == email)
            result = await db.execute(stmt)
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                print(f"❌ Usuário {email} já existe!")
                return
            
            # Criar usuário admin
            user_data = UserCreate(email=email, password=password)
            user = await UserService.register_new_user(db, user_data)
            
            # Dar créditos extras e plano enterprise
            user.credits = 1000
        
            await db.commit()
            
            print(f"✅ Usuário admin criado: {email}")
            print(f"🎯 Créditos: 1000")
            print(f"📋 Plano: Enterprise")
            
        except Exception as e:
            print(f"❌ Erro ao criar admin: {e}")


async def reset_database():
    """Resetar completamente o banco de dados"""
    print("⚠️  ATENÇÃO: Esta ação irá DELETAR todos os dados!")
    confirm = input("Digite 'CONFIRMO' para continuar: ")
    
    if confirm != "CONFIRMO":
        print("❌ Operação cancelada")
        return
    
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        
        print("✅ Banco de dados resetado com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro ao resetar banco: {e}")


async def create_tables():
    """Cria tabelas que ainda não existem (sem dropar dados)."""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Tabelas criadas/atualizadas com sucesso!")
    except Exception as e:
        print(f"❌ Erro ao criar tabelas: {e}")

def _run_alembic_upgrade(revision: str) -> None:
    """Executa o comando alembic upgrade síncrono em uma thread separada."""
    from alembic import command
    from alembic.config import Config

    alembic_ini_path = os.path.join(_PROJECT_ROOT, "alembic.ini")
    if not os.path.exists(alembic_ini_path):
        raise FileNotFoundError(
            f"Arquivo alembic.ini não encontrado em '{alembic_ini_path}'"
        )

    cfg = Config(alembic_ini_path)
    cfg.set_main_option("script_location", os.path.join(_PROJECT_ROOT, "alembic"))
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.upgrade(cfg, revision)


async def upgrade_database(revision: str = "head"):
    """Executa as migrações do Alembic para o revision informado (default: head)."""
    try:
        print(f"🚀 Executando migrações Alembic até '{revision}'...")
        await asyncio.to_thread(_run_alembic_upgrade, revision)
        print("✅ Migrações aplicadas com sucesso!")
    except FileNotFoundError as e:
        print(f"❌ {e}")
    except Exception as e:
        print(f"❌ Erro ao executar migrações: {e}")


async def seed_sample_data():
    """Popular banco com dados de exemplo"""
    async with SessionLocal() as db:
        try:
            from decimal import Decimal
            import random
            
            # Criar usuários de exemplo
            sample_users = [
                ("joao@exemplo.com", "senha123A"),
                ("maria@exemplo.com", "senha123B"), 
                ("carlos@exemplo.com", "senha123C")
            ]
            
            for email, password in sample_users:
                user_data = UserCreate(email=email, password=password)
                user = await UserService.register_new_user(db, user_data)
                
                # Criar histórico de exemplo
                for i in range(random.randint(3, 8)):
                    history = QueryHistory(
                        user_id=user.id,
                        icms_value=Decimal(str(random.uniform(100, 10000))),
                        months=random.randint(1, 24),
                        calculated_value=Decimal(str(random.uniform(50, 5000))),
                        calculation_time_ms=random.randint(10, 200)
                    )
                    db.add(history)
            
            await db.commit()
            print("✅ Dados de exemplo criados com sucesso!")
            
        except Exception as e:
            print(f"❌ Erro ao criar dados: {e}")

async def cleanup_old_logs():
    """Limpar logs de auditoria antigos (mais de 1 ano)"""
    async with SessionLocal() as db:
        try:
            from sqlalchemy import delete
            
            cutoff_date = datetime.now() - timedelta(days=365)
            
            stmt = delete(AuditLog).where(AuditLog.created_at < cutoff_date)
            result = await db.execute(stmt)
            await db.commit()
            
            print(f"✅ {result.rowcount} logs antigos removidos")
            
        except Exception as e:
            print(f"❌ Erro ao limpar logs: {e}")


async def show_system_stats():
    """Mostrar estatísticas do sistema"""
    async with SessionLocal() as db:
        try:
            from sqlalchemy import select, func
            
            # Total de usuários
            users_count = await db.execute(select(func.count(User.id)))
            total_users = users_count.scalar()
            
            # Total de cálculos
            calc_count = await db.execute(select(func.count(QueryHistory.id)))
            total_calculations = calc_count.scalar()
            
            
            print("📊 ESTATÍSTICAS DO SISTEMA")
            print("=" * 40)
            print(f"👥 Total de usuários: {total_users}")
            print(f"🧮 Total de cálculos: {total_calculations}")
            
            
            # Cálculos hoje
            today = datetime.now().date()
            today_calc = await db.execute(
                select(func.count(QueryHistory.id))
                .where(QueryHistory.created_at >= today)
            )
            print(f"\n📈 Cálculos hoje: {today_calc.scalar()}")
            
        except Exception as e:
            print(f"❌ Erro ao buscar estatísticas: {e}")


async def main():
    """Função principal do script de gerenciamento"""
    if len(sys.argv) < 2:
        print("🔧 Torres Project - Script de Gerenciamento")
        print("\nComandos disponíveis:")
        print("  create-admin <email> <password>  - Criar usuário admin")
        print("  reset-db                        - Resetar banco de dados")
        print("  seed-data                       - Popular com dados exemplo")
        print("  cleanup-logs                    - Limpar logs antigos")
        print("  stats                           - Mostrar estatísticas")
        print("  create-tables                   - Criar tabelas que faltam (sem dropar)")
        print("  upgrade-db [revision]           - Executar migrações Alembic (padrão head)")
        print("\nExemplo: python scripts/manage.py create-admin admin@exemplo.com minhasenha123A")
        return
    
    command = sys.argv[1]
    
    if command == "create-admin":
        if len(sys.argv) != 4:
            print("❌ Uso: create-admin <email> <password>")
            return
        await create_admin_user(sys.argv[2], sys.argv[3])
        
    elif command == "reset-db":
        await reset_database()
        
    elif command == "seed-data":
        await seed_sample_data()
        
    elif command == "cleanup-logs":
        await cleanup_old_logs()
        
    elif command == "stats":
        await show_system_stats()
    
    elif command == "create-tables":
        await create_tables()

    elif command == "upgrade-db":
        revision = sys.argv[2] if len(sys.argv) >= 3 else "head"
        await upgrade_database(revision)
        
    else:
        print(f"❌ Comando desconhecido: {command}")


if __name__ == "__main__":
    asyncio.run(main())
