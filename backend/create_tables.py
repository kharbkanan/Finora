
from database import Base, engine
from models import Transaction, User , SavingsGoal , MonthlyBudget

Base.metadata.create_all(bind=engine)

print("Database tables created successfully!")
