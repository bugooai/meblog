"""API layer for Projects - HTTP handling."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.database import get_db
from app.schemas import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services import ProjectService
from app.utils.security import get_current_user
from app.models import Admin

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    include_hidden: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user),
):
    return await ProjectService.list_projects(db, current_user=current_user, include_hidden=include_hidden)


@router.get("/{slug}", response_model=ProjectResponse)
async def get_project_by_slug_endpoint(
    slug: str,
    include_hidden: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user),
):
    return await ProjectService.get_project_by_slug(
        db,
        slug,
        current_user=current_user,
        include_hidden=include_hidden,
    )


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_new_project(
    project: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user)
):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await ProjectService.create_project(db, project, current_user)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_existing_project(
    project_id: str,
    project: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user)
):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await ProjectService.update_project(db, project_id, project, current_user)


@router.delete("/{project_id}", status_code=204)
async def delete_existing_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[Admin] = Depends(get_current_user)
):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    await ProjectService.delete_project(db, project_id)
    return None
