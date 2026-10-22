from collections import Counter
from datetime import datetime, timedelta


def analyze_transaction(transaction, history=None):
    """
    Rule-based transaction risk screening.
    This identifies warning signs, not confirmed fraud.
    """
    history = history or []
    reasons = []
    score = 0

    def get_value(item, key, default=None):
        if isinstance(item, dict):
            return item.get(key, default)
        return getattr(item, key, default)

    amount = float(get_value(transaction, "amount", 0) or 0)
    category = str(get_value(transaction, "category", "") or "").lower()
    description = str(
        get_value(transaction, "description", "")
        or get_value(transaction, "title", "")
        or ""
    ).lower()

    if amount <= 0:
        return {
            "risk_level": "low",
            "risk_score": 0,
            "reasons": [],
            "message": "No positive transaction amount to assess."
        }

    amounts = [
        float(get_value(item, "amount", 0) or 0)
        for item in history
    ]
    positive_amounts = [value for value in amounts if value > 0]

    # Large transaction compared with the user's recent history.
    if len(positive_amounts) >= 3:
        average = sum(positive_amounts) / len(positive_amounts)
        if amount >= max(10000, average * 3):
            score += 30
            reasons.append(
                "Amount is unusually large compared with transaction history."
            )
    elif amount >= 50000:
        score += 20
        reasons.append("High-value transaction; verify the recipient.")

    # Repeated transactions with the same amount and description.
    matching = 0
    for item in history:
        old_amount = float(get_value(item, "amount", 0) or 0)
        old_description = str(
            get_value(item, "description", "")
            or get_value(item, "title", "")
            or ""
        ).strip().lower()

        if (
            old_amount == amount
            and description
            and old_description == description
        ):
            matching += 1

    if matching >= 2:
        score += 35
        reasons.append(
            "Several transactions have the same amount and description."
        )

    # Potentially risky transaction notes; these are indicators only.
    risk_terms = {
        "otp": "Description mentions OTP.",
        "upi pin": "Description mentions a UPI PIN.",
        "urgent transfer": "Description mentions an urgent transfer.",
        "processing fee": "Description mentions a processing fee.",
        "security deposit": "Description mentions a security deposit.",
        "unknown recipient": "Description mentions an unknown recipient.",
    }

    for term, reason in risk_terms.items():
        if term in description:
            score += 20
            reasons.append(reason)

    # Several transactions recorded within a short time window.
    now = datetime.now()
    recent_count = 0

    for item in history:
        raw_date = get_value(item, "date")
        if isinstance(raw_date, str):
            try:
                raw_date = datetime.fromisoformat(
                    raw_date.replace("Z", "+00:00")
                ).replace(tzinfo=None)
            except ValueError:
                raw_date = None

        if isinstance(raw_date, datetime):
            if now - timedelta(minutes=10) <= raw_date <= now:
                recent_count += 1

    if recent_count >= 4:
        score += 20
        reasons.append(
            "Multiple transactions appear to have occurred within a short period."
        )

    score = min(score, 100)

    if score >= 60:
        level = "high"
        message = "Multiple warning signs detected. Verify this transaction."
    elif score >= 30:
        level = "medium"
        message = "Some unusual indicators detected. Review this transaction."
    else:
        level = "low"
        message = "No strong warning signs detected by the current rules."

    if not reasons:
        reasons.append("No configured risk indicators were triggered.")

    return {
        "risk_level": level,
        "risk_score": score,
        "reasons": reasons,
        "message": message,
    }
