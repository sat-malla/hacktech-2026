import requests
import time
import threading
import pandas as pd
from collections import deque
from datetime import datetime
import os
import db
import dbapp

PATH = "http://10.137.171.235/data"

_buffer = deque()
_lock = threading.Lock()


def fetch_loop():
    while True:
        try:
            data = requests.get(PATH).json()
            print(data)
            with _lock:
                _buffer.append(data)
            print("Here")
            record = dbapp.create_log_record(data)
            #print(data)
            print("record")
        except Exception as e:
            print(f"fetch error: {e}")
        time.sleep(2)


def query_dataframe() -> pd.DataFrame:
    with _lock:
        records = list(_buffer)
    return pd.DataFrame(records)


def query_loop():
    while True:
        time.sleep(500)
        df = query_dataframe()
        print("query outputted to csv")
        df.to_csv(os.path.join(os.getcwd(),f'csv_output/{datetime.now().strftime("%Y-%m-%d_%H-%M-%S")}.csv'), index=False)
        _buffer.clear()
             



if __name__ == "__main__":
    print("daemon started")
    t_fetch = threading.Thread(target=fetch_loop, daemon=True)
    t_query = threading.Thread(target=query_loop, daemon=True)
    t_fetch.start()
    t_query.start()
    t_fetch.join()
