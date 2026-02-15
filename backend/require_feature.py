from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.services.feature_flags import has_feature
from app.api.auth import get_current_user


def require_feature(feature_key: str):
    def dependency(
        db: Session = Depends(get_db),
        current_user = Depends(get_current_user),
    ):
        if not has_feature(db, current_user.plan, feature_key):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_key}' not available for your plan",
            )
        return True

    return dependency
