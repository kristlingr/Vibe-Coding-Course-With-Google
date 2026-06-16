import os
import sys
import mimetypes
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

# If modifying these scopes, delete the file token.json.
# 'drive.file' scope allows creating and editing files created by this app.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_credentials():
    """Gets valid user credentials from storage or runs OAuth flow."""
    creds = None
    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first time.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists('credentials.json'):
                print("Error: 'credentials.json' not found.")
                print("Please download your OAuth 2.0 Client credentials from the Google Cloud Console")
                print("and save it as 'credentials.json' in this directory.")
                print("Reference: https://developers.google.com/workspace/guides/create-credentials")
                sys.exit(1)
                
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Save the credentials for the next run
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
            
    return creds

def upload_file(file_path, folder_id=None):
    """Uploads a local file to Google Drive."""
    if not os.path.exists(file_path):
        print(f"Error: Local file '{file_path}' does not exist.")
        return None

    creds = get_credentials()

    try:
        service = build('drive', 'v3', credentials=creds)

        file_name = os.path.basename(file_path)
        # Guess MIME type or default to binary stream
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = 'application/octet-stream'

        # Set file metadata
        file_metadata = {
            'name': file_name
        }
        
        # If folder_id is specified, add it to parents
        if folder_id:
            file_metadata['parents'] = [folder_id]

        # Prepare media upload
        media = MediaFileUpload(
            file_path,
            mimetype=mime_type,
            resumable=True
        )

        print(f"Uploading '{file_name}' ({mime_type}) to Google Drive...")
        
        # Execute create request
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink'
        ).execute()

        print("\n🎉 Upload Successful!")
        print(f"File Name: {file.get('name')}")
        print(f"File ID:   {file.get('id')}")
        print(f"Link:      {file.get('webViewLink')}")
        
        return file.get('id')

    except HttpError as error:
        print(f"An API error occurred: {error}")
        return None

if __name__ == '__main__':
    # Simple CLI argument handling
    if len(sys.argv) < 2:
        print("Usage: python upload_to_drive.py <path_to_local_file> [target_folder_id]")
        sys.exit(1)
        
    local_file = sys.argv[1]
    target_folder = sys.argv[2] if len(sys.argv) > 2 else None
    
    upload_file(local_file, target_folder)
