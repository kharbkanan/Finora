from datetime import datetime, timedelta


def analyze_transaction(transaction, history=None):
    history = history or []
    reasons = []
    score = 0

    def get_value(item, key, default=None):
        if isinstance(item, dict):
            return item.get(key, default)
        return getattr(item, key, default)

    amount = float(get_value(transaction, "amount", 0) or 0)
    title = str(get_value(transaction, "title", "") or "").strip().lower()
    description = str(
        get_value(transaction, "description", "")
        or get_value(transaction, "notes", "")
        or title
    ).strip().lower()

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
        if float(get_value(item, "amount", 0) or 0) > 0
    ]

    if len(amounts) >= 3:
        average = sum(amounts) / len(amounts)
        if amount >= max(5000, average * 3):
            score += 35
            reasons.append(
                "Amount is unusually high compared with transaction history."
            )
    elif amount >= 50000:
        score += 25
        reasons.append("High-value transaction; verify the recipient.")

    matches = 0
    for item in history:
        old_amount = float(get_value(item, "amount", 0) or 0)
        old_title = str(
            get_value(item, "title", "") or ""
        ).strip().lower()

        if old_amount == amount and title and old_title == title:
            matches += 1

    if matches >= 1:
        score += 35
        reasons.append(
            "A transaction with the same title and amount already exists."
        )

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
            score += 25
            reasons.append(reason)

    now = datetime.now()
    recent_count = 0

    for item in history:
        raw_date = get_value(item, "date", None)
        if raw_date is None:
            raw_date = get_value(item, "transaction_date", None)

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
            "Several transactions have timestamps within a short period."
        )

    score = min(score, 100)

    if score >= 60:
        level = "high"
        message = "Multiple warning signs detected. Verify this transaction."
    elif score >= 30:
        level = "medium"
        message = "Unusual indicators detected. Review this transaction."
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
