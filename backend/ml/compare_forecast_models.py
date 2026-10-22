
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error

# 1. Generate synthetic monthly expense data
np.random.seed(42)

months = pd.date_range(
    start="2024-11-01",
    periods=24,
    freq="MS"
)

month_number = np.arange(1, 25)

expenses = (
    3000
    + 60 * month_number
    + 150 * np.sin(2 * np.pi * month_number / 12)
    + np.random.normal(0, 120, 24)
)

df = pd.DataFrame({
    "month": months,
    "month_number": month_number,
    "expense": expenses
})

# 2. Split chronologically: 18 months for training,
#    last 6 months for testing
train = df.iloc[:18].copy()
test = df.iloc[18:].copy()

y_train = train["expense"]
y_test = test["expense"]

# 3. Model A: Linear Regression using trend only
X_train_a = train[["month_number"]]
X_test_a = test[["month_number"]]

model_a = LinearRegression()
model_a.fit(X_train_a, y_train)
pred_a = model_a.predict(X_test_a)

# 4. Model B: Linear Regression using trend + seasonality
# 4. Create seasonal features before splitting the data
df["month_of_year"] = df["month"].dt.month

df["sin_month"] = np.sin(
    2 * np.pi * df["month_of_year"] / 12
)

df["cos_month"] = np.cos(
    2 * np.pi * df["month_of_year"] / 12
)

# Refresh train and test so they include the new features
train = df.iloc[:18].copy()
test = df.iloc[18:].copy()

y_train = train["expense"]
y_test = test["expense"]

features_b = ["month_number", "sin_month", "cos_month"]

model_b = LinearRegression()
model_b.fit(train[features_b], y_train)
pred_b = model_b.predict(test[features_b])

# 5. Calculate evaluation metrics
def evaluate_model(actual, predicted):
    mae = mean_absolute_error(actual, predicted)
    rmse = np.sqrt(mean_squared_error(actual, predicted))
    return mae, rmse

mae_a, rmse_a = evaluate_model(y_test, pred_a)
mae_b, rmse_b = evaluate_model(y_test, pred_b)

# 6. Display actual vs predicted expenses
results = pd.DataFrame({
    "Month": test["month"].dt.strftime("%Y-%m"),
    "Actual": y_test.to_numpy(),
    "Model_A_Trend": pred_a,
    "Model_B_Seasonal": pred_b
})

print("\nNOTE: Evaluation uses synthetic data only.")
print("\nActual vs Predicted Expenses:")
print(results.round(2).to_string(index=False))

print("\nMODEL COMPARISON")
print("-" * 40)
print(f"Model A (Trend only) MAE: {mae_a:.2f}")
print(f"Model A (Trend only) RMSE: {rmse_a:.2f}")
print()
print(f"Model B (Trend + Seasonality) MAE: {mae_b:.2f}")
print(f"Model B (Trend + Seasonality) RMSE: {rmse_b:.2f}")

print("\nFINAL RESULT")
if mae_b < mae_a:
    print("Model B performed better based on MAE.")
elif mae_a < mae_b:
    print("Model A performed better based on MAE.")
else:
    print("Both models have the same MAE.")

print("Compare both MAE and RMSE before choosing a model.")
