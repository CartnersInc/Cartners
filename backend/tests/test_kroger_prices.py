import unittest
from unittest.mock import patch

from app.services.kroger_prices import KrogerError, lookup_ingredients


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

    @patch("app.services.kroger_prices.get_access_token")
    def test_rejects_empty_ingredients_before_network_access(self, token):
        with self.assertRaises(KrogerError):
            lookup_ingredients(["  "], "98105")
        token.assert_not_called()


if __name__ == "__main__":
    unittest.main()
