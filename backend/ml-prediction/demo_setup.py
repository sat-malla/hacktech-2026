import db

database = db.SupabaseConnector()

"""
value = database.create("plant", {
    "name": "Raspberry",
    "optimal_moisture": 0.35,
    "optimal_temperature": 70,
    "optimal_drainage": 3
})"""

value = database.create("plant", {
    "name": "Tomato",
    "optimal_moisture": 0.3,
    "optimal_temperature":70,
    "optimal_drainage": 1.25
})


monitor = database.create("monitors", {
    "id": 1,
    "location": "My Garden",
    "plant": "Tomato"
}
)
print(monitor)

