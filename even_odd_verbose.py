print("בדיקת מספר זוגי או אי-זוגי")
print("----------------------------")

user_input = input("הכנס מספר לבדיקה: ")
number = int(user_input)

print(f"המספר שהוזן הוא: {number}")

if number % 2 == 0:
    print("המספר הוא זוגי.")
else:
    print("המספר הוא אי-זוגי.")

print("תודה שהשתמשת בתוכנית!")
