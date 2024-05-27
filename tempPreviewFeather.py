
import sys
import json
import pandas as pd

feather_file_path = sys.argv[1]
page = int(sys.argv[2])
rows_per_page = 100

df = pd.read_feather(feather_file_path)
total_rows = len(df)
start_index = (page - 1) * rows_per_page
end_index = start_index + rows_per_page

result = {
    'totalRows': total_rows,
    'currentPage': page,
    'rowsPerPage': rows_per_page,
    'dataHtml': df.iloc[start_index:end_index].to_html(index=False)
}

print(json.dumps(result))
