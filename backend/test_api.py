
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from main import app, get_db
from unittest.mock import patch
from decimal import Decimal

@pytest.fixture
def client():
    # One isolated in-memory SQLite database for each test.
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
    )

    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


def register_and_login(client, email="test@example.com"):
    registration = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "TestPassword123!",
        },
    )
    assert registration.status_code == 201

    login = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "TestPassword123!",
        },
    )
    assert login.status_code == 200

    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_register_user(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "TestPassword123!",
        },
    )

    assert response.status_code == 201
    assert response.json()["email"] == "newuser@example.com"
    assert "password_hash" not in response.json()


def test_duplicate_registration_is_rejected(client):
    payload = {
        "email": "duplicate@example.com",
        "password": "TestPassword123!",
    }

    first = client.post("/auth/register", json=payload)
    second = client.post("/auth/register", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409


def test_login_returns_access_token(client):
    headers = register_and_login(client)

    assert headers["Authorization"].startswith("Bearer ")


def test_transactions_require_authentication(client):
    response = client.get("/transactions")

    assert response.status_code in (401, 403)


def test_authenticated_user_can_create_and_list_transaction(client):
    headers = register_and_login(client)

    payload = {
        "title": "Groceries",
        "amount": "250.00",
        "category": "Food",
        "transaction_type": "expense",
        "transaction_date": "2026-10-14",
        "notes": "Test transaction",
    }

    created = client.post(
        "/transactions",
        json=payload,
        headers=headers,
    )
    assert created.status_code == 200, created.text

    listed = client.get("/transactions", headers=headers)
    assert listed.status_code == 200

    transactions = listed.json()
    assert any(item["title"] == "Groceries" for item in transactions)



def test_users_cannot_access_each_others_transactions(client):
    user_a_headers = register_and_login(
        client,
        email="user_a@example.com",
    )
    user_b_headers = register_and_login(
        client,
        email="user_b@example.com",
    )

    payload = {
        "title": "Private Expense",
        "amount": "500.00",
        "category": "Personal",
        "transaction_type": "expense",
        "transaction_date": "2026-10-14",
        "notes": "Belongs only to user A",
    }

    created = client.post(
        "/transactions",
        json=payload,
        headers=user_a_headers,
    )
    assert created.status_code == 200, created.text

    user_b_transactions = client.get(
        "/transactions",
        headers=user_b_headers,
    )
    assert user_b_transactions.status_code == 200

    assert all(
        item["title"] != "Private Expense"
        for item in user_b_transactions.json()
    )

    transaction_id = created.json()["id"]

    deleted_by_user_b = client.delete(
        f"/transactions/{transaction_id}",
        headers=user_b_headers,
    )
    assert deleted_by_user_b.status_code == 404

    user_a_transactions = client.get(
        "/transactions",
        headers=user_a_headers,
    )
    assert any(
        item["id"] == transaction_id
        for item in user_a_transactions.json()
    )


def test_invalid_token_is_rejected(client):
    headers = {
        "Authorization": "Bearer invalid.fake.token"
    }

    response = client.get(
        "/transactions",
        headers=headers,
    )

    assert response.status_code == 401


def test_financial_analysis_uses_authenticated_users_data(client):
    headers = register_and_login(
        client,
        email="analysis_user@example.com",
    )

    transactions = [
        {
            "title": "Monthly Salary",
            "amount": "10000.00",
            "category": "Salary",
            "transaction_type": "income",
            "transaction_date": "2026-10-01",
            "notes": "Test income",
        },
        {
            "title": "Groceries",
            "amount": "2000.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-05",
            "notes": "Test expense",
        },
    ]

    for transaction in transactions:
        response = client.post(
            "/transactions",
            json=transaction,
            headers=headers,
        )
        assert response.status_code == 200, response.text

    response = client.get(
        "/financial-analysis",
        headers=headers,
    )

    assert response.status_code == 200, response.text

    result = response.json()
    assert result["total_income"] == "10000.00"
    assert result["total_expenses"] == "2000.00"
    assert result["remaining_balance"] == "8000.00"
    assert result["savings_rate_percent"] == "80.00"
    assert result["highest_spending_category"] == "Food"



def test_monthly_spending_comparison_and_alerts(client):
    headers = register_and_login(
        client,
        email="monthly_user@example.com",
    )

    transactions = [
        {
            "title": "Salary January",
            "amount": "10000.00",
            "category": "Salary",
            "transaction_type": "income",
            "transaction_date": "2026-01-05",
            "notes": None,
        },
        {
            "title": "January Food",
            "amount": "2000.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-01-10",
            "notes": None,
        },
        {
            "title": "February Food",
            "amount": "9000.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-02-10",
            "notes": None,
        },
    ]

    for transaction in transactions:
        response = client.post(
            "/transactions",
            json=transaction,
            headers=headers,
        )
        assert response.status_code == 200, response.text

    monthly = client.get(
        "/financial-analysis/monthly-spending",
        headers=headers,
    )
    assert monthly.status_code == 200, monthly.text
    monthly_data = monthly.json()

    assert any(
        item["month"] == "2026-01"
        and item["total_expenses"] == "2000.00"
        for item in monthly_data
    )
    assert any(
        item["month"] == "2026-02"
        and item["total_expenses"] == "9000.00"
        for item in monthly_data
    )

    comparison = client.get(
        "/financial-analysis/monthly-comparison",
        headers=headers,
    )
    assert comparison.status_code == 200, comparison.text

    february = next(
        item for item in comparison.json()
        if item["month"] == "2026-02"
    )
    assert february["change_amount"] == "7000.00"
    assert february["change_percent"] == "350.00"
    assert february["trend"] == "increased"

    alerts = client.get(
        "/financial-analysis/alerts",
        headers=headers,
    )
    assert alerts.status_code == 200, alerts.text
    assert isinstance(alerts.json()["alerts"], list)
    assert any(
        alert["type"] == "expenses_exceed_income"
        for alert in alerts.json()["alerts"]
    )


def test_transaction_rejects_zero_amount(client):
    headers = register_and_login(
        client,
        email="zero_amount@example.com",
    )

    response = client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "Invalid Expense",
            "amount": "0.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-14",
            "notes": None,
        },
    )

    assert response.status_code == 422


def test_transaction_rejects_blank_title(client):
    headers = register_and_login(
        client,
        email="blank_title@example.com",
    )

    response = client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "   ",
            "amount": "100.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-14",
            "notes": None,
        },
    )

    assert response.status_code == 422


def test_transaction_rejects_invalid_type(client):
    headers = register_and_login(
        client,
        email="invalid_type@example.com",
    )

    response = client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "Invalid Type",
            "amount": "100.00",
            "category": "Food",
            "transaction_type": "transfer",
            "transaction_date": "2026-10-14",
            "notes": None,
        },
    )

    assert response.status_code == 422


def test_transaction_rejects_oversized_notes(client):
    headers = register_and_login(
        client,
        email="long_notes@example.com",
    )

    response = client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "Test Expense",
            "amount": "100.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-14",
            "notes": "x" * 501,
        },
    )

    assert response.status_code == 422



def test_financial_recommendations_use_authenticated_users_data(client):
    headers = register_and_login(
        client,
        email="recommendations@example.com",
    )

    client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "Monthly Salary",
            "amount": "10000.00",
            "category": "Salary",
            "transaction_type": "income",
            "transaction_date": "2026-10-01",
            "notes": None,
        },
    )

    client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "Groceries",
            "amount": "9000.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-02",
            "notes": None,
        },
    )

    response = client.get(
        "/financial-analysis/recommendations",
        headers=headers,
    )

    assert response.status_code == 200

    data = response.json()
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

    recommendation_types = [
        item["type"] for item in data["recommendations"]
    ]

    assert "improve_savings" in recommendation_types
    assert "review_top_category" in recommendation_types



def test_savings_goal_lifecycle():
    from datetime import date
    from decimal import Decimal

    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from database import Base
    from main import app, get_db

    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine,
    )
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as client:
            register_response = client.post(
                "/auth/register",
                json={
                    "email": "savings-test@example.com",
                    "password": "TestPass123!",
                },
            )
            assert register_response.status_code in (200, 201), register_response.text

            login_response = client.post(
                "/auth/login",
                json={
                    "email": "savings-test@example.com",
                    "password": "TestPass123!",
                },
            )
            assert login_response.status_code == 200, login_response.text
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            create_response = client.post(
                "/savings-goals",
                headers=headers,
                json={
                    "goal_name": "Emergency Fund",
                    "target_amount": "10000.00",
                    "current_amount": "1000.00",
                    "target_date": date.today().isoformat(),
                },
            )
            assert create_response.status_code == 201, create_response.text
            goal_id = create_response.json()["id"]

            list_response = client.get("/savings-goals", headers=headers)
            assert list_response.status_code == 200, list_response.text
            assert any(goal["id"] == goal_id for goal in list_response.json())

            progress_response = client.patch(
                f"/savings-goals/{goal_id}/progress",
                headers=headers,
                params={"current_amount": "2500.00"},
            )
            assert progress_response.status_code == 200, progress_response.text
            assert Decimal(progress_response.json()["current_amount"]) == Decimal("2500.00")

            delete_response = client.delete(
                f"/savings-goals/{goal_id}",
                headers=headers,
            )
            assert delete_response.status_code == 204, delete_response.text

            final_list = client.get("/savings-goals", headers=headers)
            assert final_list.status_code == 200
            assert all(goal["id"] != goal_id for goal in final_list.json())

    finally:
        app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=test_engine)
        test_engine.dispose()



def test_budget_status_calculates_remaining_and_percentage(client):
    headers = register_and_login(
        client,
        email="budget_status@example.com",
    )

    # Create a Food expense of 1,750 for October.
    transaction_response = client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "October groceries",
            "amount": "1750.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-10",
            "notes": None,
        },
    )
    assert transaction_response.status_code == 200, transaction_response.text

    # Set the October Food budget to 3,500.
    budget_response = client.post(
        "/budgets",
        headers=headers,
        json={
            "category": "Food",
            "budget_amount": "3500.00",
            "month_start": "2026-10-01",
        },
    )
    assert budget_response.status_code in (200, 201), budget_response.text

    # Request the category-wise budget status.
    status_response = client.get(
        "/budgets/status",
        headers=headers,
        params={"month_start": "2026-10-01"},
    )
    assert status_response.status_code == 200, status_response.text

    data = status_response.json()
    food = next(
        item for item in data["budgets"]
        if item["category"] == "Food"
    )

    assert food["budget_amount"] == "3500.00"
    assert food["spent_amount"] == "1750.00"
    assert food["remaining_amount"] == "1750.00"
    assert food["usage_percent"] == "50.00"
    assert food["status"] == "on_track"



def test_budget_status_near_limit(client):
    headers = register_and_login(
        client,
        email="budget_near_limit@example.com",
    )

    transaction_response = client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "Food spending",
            "amount": "2800.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-10",
            "notes": None,
        },
    )
    assert transaction_response.status_code == 200, transaction_response.text

    budget_response = client.post(
        "/budgets",
        headers=headers,
        json={
            "category": "Food",
            "budget_amount": "3500.00",
            "month_start": "2026-10-01",
        },
    )
    assert budget_response.status_code in (200, 201), budget_response.text

    response = client.get(
        "/budgets/status",
        headers=headers,
        params={"month_start": "2026-10-01"},
    )
    assert response.status_code == 200, response.text

    food = next(
        item for item in response.json()["budgets"]
        if item["category"] == "Food"
    )

    assert food["usage_percent"] == "80.00"
    assert food["status"] == "near_limit"


def test_budget_status_exceeded(client):
    headers = register_and_login(
        client,
        email="budget_exceeded@example.com",
    )

    transaction_response = client.post(
        "/transactions",
        headers=headers,
        json={
            "title": "Food spending",
            "amount": "2000.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-10",
            "notes": None,
        },
    )
    assert transaction_response.status_code == 200, transaction_response.text

    budget_response = client.post(
        "/budgets",
        headers=headers,
        json={
            "category": "Food",
            "budget_amount": "1500.00",
            "month_start": "2026-10-01",
        },
    )
    assert budget_response.status_code in (200, 201), budget_response.text

    response = client.get(
        "/budgets/status",
        headers=headers,
        params={"month_start": "2026-10-01"},
    )
    assert response.status_code == 200, response.text

    food = next(
        item for item in response.json()["budgets"]
        if item["category"] == "Food"
    )

    assert food["spent_amount"] == "2000.00"
    assert food["remaining_amount"] == "-500.00"
    assert food["usage_percent"] == "133.33"
    assert food["status"] == "exceeded"



def test_budget_status_is_user_specific(client):
    user1_headers = register_and_login(
        client,
        email="budget_owner@example.com",
    )
    user2_headers = register_and_login(
        client,
        email="another_budget_user@example.com",
    )

    budget_response = client.post(
        "/budgets",
        headers=user1_headers,
        json={
            "category": "Food",
            "budget_amount": "3500.00",
            "month_start": "2026-10-01",
        },
    )
    assert budget_response.status_code in (200, 201), budget_response.text

    response = client.get(
        "/budgets/status",
        headers=user2_headers,
        params={"month_start": "2026-10-01"},
    )
    assert response.status_code == 200, response.text

    data = response.json()
    assert all(
        budget["category"] != "Food"
        for budget in data["budgets"]
    )




def test_expense_budget_forecast_requires_enough_history(client):
    headers = register_and_login(client)

    response = client.get(
        "/ml/expense-budget-forecast",
        headers=headers,
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["status"] == "insufficient_data"
    assert data["predicted_expense"] is None
    assert data["forecast_month"] is None
    assert data["budget_comparison"] is None




def test_expense_budget_forecast_within_budget(client):
    headers = register_and_login(client)

    transaction_response = client.post(
        "/transactions",
        json={
            "title": "October groceries",
            "amount": "250.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-14",
            "notes": "Forecast test",
        },
        headers=headers,
    )
    assert transaction_response.status_code == 200, transaction_response.text

    budget_response = client.post(
        "/budgets",
        json={
            "category": "Food",
            "budget_amount": "3500.00",
            "month_start": "2026-11-01",
        },
        headers=headers,
    )
    assert budget_response.status_code == 200, budget_response.text

    with patch(
        "main.predict_next_month_from_data",
        return_value={
            "status": "success",
            "predicted_expense": 2800.00,
            "months_used": 4,
            "model": "LinearRegression",
        },
    ):
        response = client.get(
            "/ml/expense-budget-forecast",
            headers=headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "success"
    assert data["forecast_month"] == "2026-11-01"
    assert data["predicted_expense"] == "2800.00"
    assert data["total_budget"] == "3500.00"
    assert data["difference"] == "-700.00"
    assert data["budget_comparison"] == "within_budget"




def test_expense_budget_forecast_over_budget(client):
    headers = register_and_login(client)

    transaction_response = client.post(
        "/transactions",
        json={
            "title": "October groceries",
            "amount": "250.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-10-14",
            "notes": "Forecast test",
        },
        headers=headers,
    )
    assert transaction_response.status_code == 200, transaction_response.text

    budget_response = client.post(
        "/budgets",
        json={
            "category": "Food",
            "budget_amount": "3500.00",
            "month_start": "2026-11-01",
        },
        headers=headers,
    )
    assert budget_response.status_code == 200, budget_response.text

    with patch(
        "main.predict_next_month_from_data",
        return_value={
            "status": "success",
            "predicted_expense": 4200.00,
            "months_used": 4,
            "model": "LinearRegression",
        },
    ):
        response = client.get(
            "/ml/expense-budget-forecast",
            headers=headers,
        )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "success"
    assert data["forecast_month"] == "2026-11-01"
    assert data["predicted_expense"] == "4200.00"
    assert data["total_budget"] == "3500.00"
    assert data["difference"] == "700.00"
    assert data["budget_comparison"] == "over_budget"



def test_expense_prediction_requires_enough_history(client):
    headers = register_and_login(client)

    response = client.get(
        "/ml/expense-prediction",
        headers=headers,
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["status"] == "insufficient_data"
    assert data["predicted_expense"] is None
    assert data["months_used"] == 0
    assert data["historical_months"] == []


def test_expense_prediction_with_expense_history(client):
    headers = register_and_login(client)

    transactions = [
        {
            "title": "January groceries",
            "amount": "1000.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-01-15",
        },
        {
            "title": "February groceries",
            "amount": "1200.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-02-15",
        },
        {
            "title": "March groceries",
            "amount": "1400.00",
            "category": "Food",
            "transaction_type": "expense",
            "transaction_date": "2026-03-15",
        },
    ]

    for transaction in transactions:
        create_response = client.post(
            "/transactions",
            json=transaction,
            headers=headers,
        )
        assert create_response.status_code == 200, (
            create_response.text
        )

    response = client.get(
        "/ml/expense-prediction",
        headers=headers,
    )

    assert response.status_code == 200, response.text

    data = response.json()

    assert data["status"] == "success"
    assert data["months_used"] == 3
    assert data["predicted_expense"] is not None
    assert len(data["historical_months"]) == 3

    assert [
        item["total_expense"]
        for item in data["historical_months"]
    ] == [1000.0, 1200.0, 1400.0]



def test_expense_prediction_requires_authentication(client):
    response = client.get("/ml/expense-prediction")

    assert response.status_code == 401



def test_expense_prediction_isolates_users(client):
    user_a_headers = register_and_login(
        client,
        email="prediction_user_a@example.com",
    )
    user_b_headers = register_and_login(
        client,
        email="prediction_user_b@example.com",
    )

    transactions = [
        ("January", "1000.00", "2026-01-15"),
        ("February", "1200.00", "2026-02-15"),
        ("March", "1400.00", "2026-03-15"),
    ]

    for title, amount, transaction_date in transactions:
        response = client.post(
            "/transactions",
            json={
                "title": title,
                "amount": amount,
                "category": "Food",
                "transaction_type": "expense",
                "transaction_date": transaction_date,
            },
            headers=user_a_headers,
        )
        assert response.status_code == 200, response.text

    response_a = client.get(
        "/ml/expense-prediction",
        headers=user_a_headers,
    )
    response_b = client.get(
        "/ml/expense-prediction",
        headers=user_b_headers,
    )

    assert response_a.status_code == 200, response_a.text
    assert response_b.status_code == 200, response_b.text

    data_a = response_a.json()
    data_b = response_b.json()

    assert len(data_a["historical_months"]) == 3
    assert [
        item["total_expense"]
        for item in data_a["historical_months"]
    ] == [1000.0, 1200.0, 1400.0]

    assert data_b["status"] == "insufficient_data"
    assert data_b["months_used"] == 0
    assert data_b["historical_months"] == []
