
from expense_prediction import predict_next_month_expense ,get_monthly_expenses

from datetime import date
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models import Base, Transaction
import pytest
from ml.train_model import predict_next_month_from_data


def test_prediction_with_insufficient_data():
    result = predict_next_month_expense([2000, 2500])

    assert result["status"] == "insufficient_data"
    assert result["predicted_expense"] is None


def test_prediction_returns_valid_result():
    result = predict_next_month_expense(
        [2000, 2200, 2400, 2600]
    )

    assert result["status"] == "success"
    assert result["predicted_expense"] == 2800.0
    assert result["months_used"] == 4
    assert result["model"] == "LinearRegression"



def test_get_monthly_expenses_groups_by_month_and_user():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestSession = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    Base.metadata.create_all(bind=engine)
    db = TestSession()

    try:
        # User 1: two expenses in January and one income.
        db.add_all([
            Transaction(
                title="Groceries",
                amount=Decimal("100.00"),
                category="Food",
                transaction_type="expense",
                transaction_date=date(2026, 1, 5),
                user_id=1,
            ),
            Transaction(
                title="Transport",
                amount=Decimal("50.00"),
                category="Travel",
                transaction_type="expense",
                transaction_date=date(2026, 1, 20),
                user_id=1,
            ),
            Transaction(
                title="Salary",
                amount=Decimal("1000.00"),
                category="Income",
                transaction_type="income",
                transaction_date=date(2026, 1, 25),
                user_id=1,
            ),
            Transaction(
                title="February bills",
                amount=Decimal("200.00"),
                category="Bills",
                transaction_type="expense",
                transaction_date=date(2026, 3, 10),
                user_id=1,
            ),
            Transaction(
                title="Other user's expense",
                amount=Decimal("999.00"),
                category="Food",
                transaction_type="expense",
                transaction_date=date(2026, 1, 12),
                user_id=2,
            ),
        ])
        db.commit()

        result = get_monthly_expenses(db, user_id=1)

        assert result == [
    {"month": "2026-01-01", "total_expense": 150.0},
    {"month": "2026-02-01", "total_expense": 0.0},
    {"month": "2026-03-01", "total_expense": 200.0},
    ]
        
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.mark.parametrize(
    "expenses",
    [
        [1000, float("nan"), 2000],
        [1000, float("inf"), 2000],
        [1000, float("-inf"), 2000],
        [1000, -200, 2000],
    ],
)
def test_prediction_rejects_invalid_expenses(expenses):
    with pytest.raises(ValueError):
        predict_next_month_from_data(expenses)
