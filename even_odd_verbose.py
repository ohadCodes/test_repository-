print("Checking whether a number is even or odd!\n")

user_input = input("Please enter a number to check: ")
number = int(user_input)

print(f"\nThe number entered is: {number}")

if number % 2 == 0:
    print("The number is even.")
else:
    print("The number is odd.")
