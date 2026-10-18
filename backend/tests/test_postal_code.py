import io
import json
import unittest
import urllib.error
from unittest.mock import patch

from app.services.postal_code import PostalCodeUnavailable, postal_code_for_point


class _Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def _payload(geographies):
    return _Response(json.dumps({"result": {"geographies": geographies}}).encode())


class PostalCodeTests(unittest.TestCase):
    @patch("app.services.postal_code.urllib.request.urlopen")
    def test_reads_the_census_zip_tabulation_area(self, urlopen):
        urlopen.return_value = _payload({
            "Counties": [{"NAME": "King County"}],
            "2020 Census ZIP Code Tabulation Areas": [{"ZCTA5": "98105", "BASENAME": "98105"}],
        })
        self.assertEqual(postal_code_for_point(47.66, -122.31), "98105")
        self.assertIn("x=-122.31", urlopen.call_args.args[0].full_url)
        self.assertIn("y=47.66", urlopen.call_args.args[0].full_url)

    @patch("app.services.postal_code.urllib.request.urlopen")
    def test_missing_zip_is_a_lookup_error(self, urlopen):
        urlopen.return_value = _payload({"States": [{"NAME": "Washington"}]})
        with self.assertRaises(LookupError):
            postal_code_for_point(0, 0)

    @patch("app.services.postal_code.urllib.request.urlopen", side_effect=urllib.error.URLError("down"))
    def test_geocoder_outage_is_retryable(self, urlopen):
        with self.assertRaises(PostalCodeUnavailable):
            postal_code_for_point(47.66, -122.31)


if __name__ == "__main__":
    unittest.main()
