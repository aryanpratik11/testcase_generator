```python
import pytest
from Sample.2 import app
import json

@pytest.fixture
def client():
    with app.test_client() as client:
        yield client

def test_get_all_posts(client):
    rv = client.get('/posts')
    assert rv.status_code == 200
    assert json.loads(rv.data) == []

    # Add some posts for subsequent tests if needed.  This test focuses solely on retrieving an empty list.

```