
from decimal import Decimal

import pytest

from financial_intelligence import (
    analyze_spending,
    calculate_monthly_spending,
    compare_monthly_spending,
    generate_spending_alerts,
    generate_financial_recommendations,
)


def test_analyze_spending_calculates_totals():
    transactions = [
        {
            "amount": "10000.00",
            "transaction_type": "income",
            "category": "Salary",
        },
        {
            "amount": "2500.00",
            "transaction_type": "expense",
            "category": "Food",
        },
        {
            "amount": "1500.00",
            "transaction_type": "expense",
            "category": "Travel",
        },
    ]

    result = analyze_spending(transactions)

    assert result["total_income"] == "10000.00"
    assert result["total_expenses"] == "4000.00"
    assert result["remaining_balance"] == "6000.00"
    assert result["savings_rate_percent"] == "60.00"
    assert result["highest_spending_category"] == "Food"


def test_analyze_spending_rejects_negative_amount():
    transactions = [
        {
            "amount": "-100.00",
            "transaction_type": "expense",
            "category": "Food",
        }
    ]

    with pytest.raises(ValueError):
        analyze_spending(transactions)


def test_monthly_spending_ignores_income():
    transactions = [
        {
            "transaction_date": __import__("datetime").date(2026, 1, 5),
            "amount": "5000.00",
            "transaction_type": "income",
        },
        {
            "transaction_date": __import__("datetime").date(2026, 1, 8),
            "amount": "1200.00",
            "transaction_type": "expense",
        },
    ]

    result = calculate_monthly_spending(transactions)

    assert result == [
        {"month": "2026-01", "total_expenses": "1200.00"}
    ]


def test_monthly_comparison_calculates_percentage():
    monthly_data = [
        {"month": "2026-01", "total_expenses": "1000.00"},
        {"month": "2026-02", "total_expenses": "1200.00"},
    ]

    result = compare_monthly_spending(monthly_data)

    assert result[1]["change_amount"] == "200.00"
    assert result[1]["change_percent"] == "20.00"
    assert result[1]["trend"] == "increased"


def test_alerts_warn_when_expenses_are_high():
    analysis = {
        "total_income": "10000.00",
        "total_expenses": "8500.00",
        "remaining_balance": "1500.00",
        "spending_by_category": {"Food": "4000.00"},
    }

    alerts = generate_spending_alerts(analysis)

    assert any(
        alert["type"] == "high_expense_ratio"
        for alert in alerts
    )



def test_spending_trend_recommendation_for_large_increase():
    from financial_intelligence import (
        generate_spending_trend_recommendations,
    )

    comparisons = [
        {
            "month": "2026-10",
            "category": "Food",
            "current_amount": "3000.00",
            "previous_month": "2026-09",
            "previous_amount": "2000.00",
            "change_amount": "1000.00",
            "change_percent": "50.00",
            "trend": "increased",
        }
    ]

    recommendations = generate_spending_trend_recommendations(
        comparisons
    )

    assert len(recommendations) == 1
    assert recommendations[0]["type"] == "category_spending_increase"
    assert recommendations[0]["category"] == "Food"
    assert recommendations[0]["change_percent"] == "50.00"



def test_budget_recommendations():
    from financial_intelligence import generate_budget_recommendations

    budgets = [
        {"category": "Food", "budget_amount": "3000.00"},
        {"category": "Travel", "budget_amount": "2000.00"},
        {"category": "Shopping", "budget_amount": "2000.00"},
    ]

    spending = {
        "Food": "2700.00",
        "Travel": "2500.00",
        "Shopping": "500.00",
    }

    recommendations = generate_budget_recommendations(
        budgets,
        spending,
    )

    assert len(recommendations) == 2

    food = next(
        item for item in recommendations
        if item["category"] == "Food"
    )
    assert food["type"] == "budget_near_limit"
    assert food["usage_percent"] == "90.00"

    travel = next(
        item for item in recommendations
        if item["category"] == "Travel"
    )
    assert travel["type"] == "budget_exceeded"
    assert travel["priority"] == "high"



def test_financial_recommendations_for_low_savings_rate():
    analysis = {
        "total_income": "10000.00",
        "total_expenses": "9000.00",
        "remaining_balance": "1000.00",
        "spending_by_category": {"Food": "4000.00"},
    }

    recommendations = generate_financial_recommendations(analysis)
    savings = next(
        item for item in recommendations
        if item["type"] == "improve_savings"
    )

    assert savings["priority"] == "medium"
    assert "10.00%" in savings["message"]


def test_financial_recommendations_for_healthy_savings_rate():
    analysis = {
        "total_income": "10000.00",
        "total_expenses": "7000.00",
        "remaining_balance": "3000.00",
        "spending_by_category": {"Food": "3000.00"},
    }

    recommendations = generate_financial_recommendations(analysis)
    savings = next(
        item for item in recommendations
        if item["type"] == "maintain_savings"
    )

    assert savings["priority"] == "low"
    assert "30.00%" in savings["message"]



def test_low_savings_recommendation_includes_target_amount():
    analysis = {
        "total_income": "10000.00",
        "total_expenses": "9000.00",
        "remaining_balance": "1000.00",
        "spending_by_category": {"Food": "4000.00"},
    }

    recommendations = generate_financial_recommendations(analysis)

    savings = next(
        item for item in recommendations
        if item["type"] == "improve_savings"
    )

    assert savings["target_savings_amount"] == "2000.00"
