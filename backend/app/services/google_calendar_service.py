import requests
from datetime import datetime, timezone

from app.models.google_integration import GoogleIntegration

GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
TIMEZONE = "America/Santiago"


def create_google_event(
    integration: GoogleIntegration,
    title: str,
    description: str,
    start_time: datetime,
    end_time: datetime,
):
    headers = {
        "Authorization": f"Bearer {integration.access_token}",
        "Content-Type": "application/json",
    }

    payload = {
        "summary": title,
        "description": description,
        "start": {
            "dateTime": start_time.replace(tzinfo=timezone.utc).isoformat(),
            "timeZone": TIMEZONE,
        },
        "end": {
            "dateTime": end_time.replace(tzinfo=timezone.utc).isoformat(),
            "timeZone": TIMEZONE,
        },
    }

    response = requests.post(
        f"{GOOGLE_CALENDAR_API}/calendars/{integration.calendar_id}/events",
        headers=headers,
        json=payload,
        timeout=10,
    )

    if response.status_code not in (200, 201):
        raise Exception(
            f"Google Calendar API error {response.status_code}: {response.text}"
        )

    return response.json()
