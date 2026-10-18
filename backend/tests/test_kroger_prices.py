import unittest
from unittest.mock import patch

from app.services.kroger_prices import KrogerError, lookup_ingredients, packages_needed
from app.store import Store


class KrogerLookupTests(unittest.TestCase):
    @patch("app.services.kroger_prices.search_products")
    @patch("app.services.kroger_prices.find_stores")
    @patch("app.services.kroger_prices.get_access_token", return_value="test-token")
    def test_lookup_returns_store_and_priced_product_options(self, token, stores, products):
        stores.return_value = [{
            "locationId": "123",
            "name": "Example Market",
            "chain": "QFC",
            "address": {"city": "Seattle", "state": "WA", "zipCode": "98105"},
        }]
        products.return_value = [{
            "productId": "milk-1",
            "brand": "Example",
            "description": "Whole milk",
            "images": [{"perspective": "front", "default": True, "sizes": [
                {"size": "medium", "url": "https://images.example/milk.jpg"},
            ]}],
            "items": [{
                "size": "half gallon",
                "soldBy": "UNIT",
                "price": {"regular": 4.29, "promo": 3.99},
                "inventory": {"stockLevel": "HIGH"},
                "aisleLocations": [{"number": "7", "description": "Dairy"}],
            }],
        }]

        result = lookup_ingredients([" milk ", "beans"], "98105")

        token.assert_called_once_with()
        stores.assert_called_once_with("test-token", "98105", limit=1, radius_miles=20)
        self.assertEqual([call.args[1] for call in products.call_args_list], ["milk", "beans"])
        self.assertEqual(result["store"]["locationId"], "123")
        self.assertEqual(result["ingredients"][0]["options"][0]["promoPrice"], 3.99)
        self.assertEqual(result["ingredients"][0]["options"][0]["aisle"], "7 Dairy")
        self.assertTrue(result["retrievedAt"].endswith("Z"))

    def test_package_count_uses_kroger_size_when_units_match(self):
        pack = packages_needed(6, "count", "10 ct", "UNIT")
        self.assertEqual(pack["packages"], 1)
        self.assertEqual(pack["packageSize"], {"quantity": 10, "unit": "ct"})
        more = packages_needed(18, "count", "10 ct", "UNIT")
        self.assertEqual(more["packages"], 2)
        milk = packages_needed(2000, "ml", "1 gal", "UNIT")
        self.assertEqual(milk["packages"], 1)
        beans = packages_needed(500, "g", "1 lb", "UNIT")
        self.assertEqual(beans["packages"], 2)

    def test_count_of_a_sized_package_buys_that_many_packages(self):
        cans = packages_needed(2, "can", "15 oz", "UNIT")
        self.assertEqual(cans["packages"], 2)
        self.assertEqual(cans["packageSize"]["unit"], "oz")

    def test_weighed_goods_scale_the_price_to_the_requested_weight(self):
        bananas = packages_needed(500, "g", "lb", "WEIGHT")
        self.assertEqual(bananas["packages"], 1)
        self.assertAlmostEqual(bananas["priceMultiplier"], 500 / 453.59237, places=4)

    def test_unknown_size_does_not_invent_a_weight_conversion(self):
        unknown = packages_needed(500, "g", "family size", "UNIT")
        self.assertEqual(unknown["packages"], 1)
        self.assertEqual(unknown["priceMultiplier"], 1.0)

    def test_kroger_basket_prices_the_packages_needed_and_skips_a_zero_promo(self):
        live = {
            "store": {"locationId": "9", "name": "QFC"},
            "ingredients": [{
                "ingredient": "Tortillas",
                "options": [
                    {
                        "productId": "out",
                        "description": "Out of stock tortillas",
                        "size": "10 ct",
                        "soldBy": "UNIT",
                        "regularPrice": 1.00,
                        "stockLevel": "TEMPORARILY_OUT_OF_STOCK",
                    },
                    {
                        "productId": "t1",
                        "description": "Flour tortillas",
                        "size": "10 ct",
                        "soldBy": "UNIT",
                        "promoPrice": 0,
                        "regularPrice": 3.50,
                        "stockLevel": "HIGH",
                    },
                ],
            }],
        }
        items = [{"id": "item-1", "name": "Tortillas", "quantity": 18, "unit": "count"}]
        basket = Store._baskets_from_kroger(None, items, live)[0]
        line = basket["items"][0]
        self.assertEqual(line["productId"], "t1")
        self.assertEqual(line["packagesNeeded"], 2)
        self.assertEqual(line["pricePerPackageCents"], 350)
        self.assertEqual(line["lineTotalCents"], 700)
        self.assertEqual(basket["knownSubtotalCents"], 700)
        self.assertTrue(basket["complete"])

    @patch("app.services.kroger_prices.get_access_token")
    def test_rejects_empty_ingredients_before_network_access(self, token):
        with self.assertRaises(KrogerError):
            lookup_ingredients(["  "], "98105")
        token.assert_not_called()


if __name__ == "__main__":
    unittest.main()
