"""Download only the official UCI dataset, with reproducible source hashes. No fallback data."""
import argparse
import hashlib
import io
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

URL = 'https://archive.ics.uci.edu/static/public/863/maternal+health+risk.zip'
PAGE = 'https://archive.ics.uci.edu/dataset/863/maternal+health+risk'
DEFAULT_PATH = Path(__file__).parent / 'data' / 'maternal_health_risk.csv'

def download(destination=DEFAULT_PATH):
    destination = Path(destination)
    with urlopen(URL, timeout=30) as response:
        archive = response.read()
    with ZipFile(io.BytesIO(archive)) as zip_file:
        names = [name for name in zip_file.namelist() if name.lower().endswith('.csv')]
        if len(names) != 1:
            raise ValueError('Expected exactly one CSV in official UCI archive')
        data = zip_file.read(names[0])
    header = data.decode('utf-8-sig').splitlines()[0]
    if header.strip() != 'Age,SystolicBP,DiastolicBP,BS,BodyTemp,HeartRate,RiskLevel':
        raise ValueError('Unexpected UCI CSV schema; download was not saved')
    metadata = {'source_url':URL, 'dataset_page':PAGE,
        'retrieved_at':datetime.now(timezone.utc).isoformat(),
        'archive_sha256':hashlib.sha256(archive).hexdigest(),
        'csv_sha256':hashlib.sha256(data).hexdigest(), 'archive_member':names[0],
        'citation':'Ahmed, M. (2020). Maternal Health Risk. UCI. DOI:10.24432/C5DP5D',
        'license':'CC BY 4.0'}
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    destination.with_suffix('.source.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
    return destination

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_PATH)
    args = parser.parse_args()
    result = download(args.output)
    print('Downloaded official UCI CSV; source metadata saved beside it.')
