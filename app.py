import os
import xml.etree.ElementTree as ET
import requests
from flask import Flask, render_template, jsonify

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(response.content)
        
        # Get namespace dynamically if it exists (e.g. {http://www.w3.org/2005/Atom})
        ns = ""
        if root.tag.startswith("{"):
            ns = root.tag.split("}")[0] + "}"
            
        entries = []
        for entry in root.findall(f"{ns}entry"):
            title_elem = entry.find(f"{ns}title")
            title = title_elem.text if title_elem is not None else ""
            
            updated_elem = entry.find(f"{ns}updated")
            updated = updated_elem.text if updated_elem is not None else ""
            
            # Find the alternate link, fallback to first link if alternate not found
            link = ""
            link_elems = entry.findall(f"{ns}link")
            for le in link_elems:
                if le.get("rel") == "alternate":
                    link = le.get("href")
                    break
            if not link and link_elems:
                link = link_elems[0].get("href")
                
            content_elem = entry.find(f"{ns}content")
            content = content_elem.text if content_elem is not None else ""
            
            entries.append({
                "title": title.strip() if title else "",
                "updated": updated.strip() if updated else "",
                "link": link.strip() if link else "",
                "content": content.strip() if content else ""
            })
            
        return {"success": True, "entries": entries}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/releases")
def get_releases():
    result = fetch_and_parse_feed()
    return jsonify(result)

if __name__ == "__main__":
    # Run locally on port 5000
    app.run(host="127.0.0.1", port=5000, debug=True)
