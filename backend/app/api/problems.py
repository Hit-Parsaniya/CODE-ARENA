from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_admin_user
from app.core.database import get_db
from app.models.problem import Problem, TestCase
from app.models.user import User
from app.schemas.problem import (
    ProblemCreate,
    ProblemDetail,
    ProblemSummary,
    ProblemUpdate,
    SampleTestCase,
    TestCaseAdmin,
    TestCaseCreate,
    TestCaseUpdate,
)

router = APIRouter(tags=["Problems"])


@router.get("/problems", response_model=list[ProblemSummary])
def list_problems(
    difficulty: str | None = Query(default=None),
    tags: list[str] = Query(default=[]),
    db: Session = Depends(get_db),
):
    query = db.query(Problem)
    if difficulty:
        query = query.filter(Problem.difficulty == difficulty.lower())
    problems = query.order_by(Problem.id.desc()).all()
    if tags:
        requested_tags = {tag.casefold() for tag in tags}
        problems = [
            problem for problem in problems
            if requested_tags.issubset({tag.casefold() for tag in problem.tags or []})
        ]
    return problems


@router.post("/problems", response_model=ProblemSummary, status_code=status.HTTP_201_CREATED)
def create_problem(
    payload: ProblemCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    problem = Problem(**payload.model_dump(), created_by=admin.id)
    db.add(problem)
    db.commit()
    db.refresh(problem)
    return problem


@router.get("/problems/{problem_id}", response_model=ProblemDetail)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found.")
    return ProblemDetail(
        **ProblemSummary.model_validate(problem).model_dump(),
        sample_test_cases=[
            SampleTestCase.model_validate(test_case)
            for test_case in problem.test_cases if test_case.is_sample
        ],
    )


@router.put("/problems/{problem_id}", response_model=ProblemSummary)
def update_problem(
    problem_id: int,
    payload: ProblemUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found.")
    for field, value in payload.model_dump().items():
        setattr(problem, field, value)
    db.commit()
    db.refresh(problem)
    return problem


@router.delete("/problems/{problem_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_problem(
    problem_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    problem = db.query(Problem).filter(Problem.id == problem_id).first()
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found.")
    db.delete(problem)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/problems/{problem_id}/test-cases", response_model=list[TestCaseAdmin])
def list_test_cases(
    problem_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    if db.query(Problem.id).filter(Problem.id == problem_id).first() is None:
        raise HTTPException(status_code=404, detail="Problem not found.")
    return db.query(TestCase).filter(TestCase.problem_id == problem_id).order_by(TestCase.id).all()


@router.post(
    "/problems/{problem_id}/test-cases",
    response_model=TestCaseAdmin,
    status_code=status.HTTP_201_CREATED,
)
def create_test_case(
    problem_id: int,
    payload: TestCaseCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    if db.query(Problem.id).filter(Problem.id == problem_id).first() is None:
        raise HTTPException(status_code=404, detail="Problem not found.")
    test_case = TestCase(problem_id=problem_id, **payload.model_dump())
    db.add(test_case)
    db.commit()
    db.refresh(test_case)
    return test_case


@router.put(
    "/problems/{problem_id}/test-cases/{test_case_id}", response_model=TestCaseAdmin
)
def update_test_case(
    problem_id: int,
    test_case_id: int,
    payload: TestCaseUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    test_case = db.query(TestCase).filter(
        TestCase.id == test_case_id, TestCase.problem_id == problem_id
    ).first()
    if test_case is None:
        raise HTTPException(status_code=404, detail="Test case not found.")
    for field, value in payload.model_dump().items():
        setattr(test_case, field, value)
    db.commit()
    db.refresh(test_case)
    return test_case


@router.delete(
    "/problems/{problem_id}/test-cases/{test_case_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_test_case(
    problem_id: int,
    test_case_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_admin_user),
):
    test_case = db.query(TestCase).filter(
        TestCase.id == test_case_id, TestCase.problem_id == problem_id
    ).first()
    if test_case is None:
        raise HTTPException(status_code=404, detail="Test case not found.")
    db.delete(test_case)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)