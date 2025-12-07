"""AWS S3 storage for Twilio recordings"""
import os
import boto3
import requests
from typing import Optional, Dict
from config import AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET
from twilio.rest import Client
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

# Initialize S3 client
s3_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        print(f"✅ S3 client initialized for bucket: {S3_BUCKET}")
    except Exception as e:
        print(f"⚠️ Failed to initialize S3 client: {e}")
        s3_client = None
else:
    print("⚠️ AWS credentials not configured. S3 storage disabled.")

# Initialize Twilio client
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN else None

def upload_recording_to_s3(call_sid: str, recording_sid: str) -> Optional[Dict[str, str]]:
    """
    Download recording from Twilio and upload to S3
    
    Args:
        call_sid: Twilio call SID
        recording_sid: Twilio recording SID
        
    Returns:
        Dict with S3 URL and metadata, or None if failed
    """
    if not s3_client:
        print("⚠️ S3 client not available. Skipping upload.")
        return None
    
    if not twilio_client:
        print("⚠️ Twilio client not available. Cannot fetch recording.")
        return None
    
    try:
        # Fetch recording from Twilio
        recording = twilio_client.recordings(recording_sid).fetch()
        
        # Get recording URL - Twilio provides .mp3 or .wav extension
        # The URI format is: /2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}.json
        # We need to replace .json with the actual file extension
        base_uri = recording.uri.replace('.json', '')
        recording_url = f"https://api.twilio.com{base_uri}"
        
        # Try different formats
        file_ext = None
        for ext in ['.mp3', '.wav']:
            try:
                test_url = f"{recording_url}{ext}"
                response = requests.get(test_url, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN), stream=True, timeout=30)
                if response.status_code == 200:
                    recording_url = test_url
                    file_ext = ext
                    break
            except:
                continue
        
        if not file_ext:
            # Default to .mp3 if format detection fails
            recording_url = f"{recording_url}.mp3"
            file_ext = '.mp3'
        
        # Download recording with Twilio auth
        auth = (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        response = requests.get(recording_url, auth=auth, stream=True, timeout=60)
        response.raise_for_status()
        
        # S3 key (path in bucket) - use the detected file extension
        s3_key = f"recordings/{call_sid}/{recording_sid}{file_ext}"
        
        # Upload to S3
        s3_client.upload_fileobj(
            response.raw,
            S3_BUCKET,
            s3_key,
            ExtraArgs={
                'ContentType': recording.content_type or 'audio/wav',
                'Metadata': {
                    'call_sid': call_sid,
                    'recording_sid': recording_sid,
                    'duration': str(recording.duration or ''),
                    'channels': str(recording.channels or '1')
                }
            }
        )
        
        # Generate S3 URL
        s3_url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{s3_key}"
        
        print(f"✅ Recording uploaded to S3: {s3_key}")
        
        return {
            's3_url': s3_url,
            's3_key': s3_key,
            'recording_sid': recording_sid,
            'duration': recording.duration,
            'file_size': recording.size,
            'content_type': recording.content_type
        }
        
    except Exception as e:
        print(f"❌ Error uploading recording to S3: {e}")
        return None

def get_recording_url_from_s3(call_sid: str, recording_sid: str) -> Optional[str]:
    """
    Get presigned URL for recording from S3
    
    Args:
        call_sid: Twilio call SID
        recording_sid: Twilio recording SID
        
    Returns:
        Presigned URL or None
    """
    if not s3_client:
        return None
    
    try:
        # Try different possible file extensions
        for ext in ['.wav', '.mp3', '.m4a']:
            s3_key = f"recordings/{call_sid}/{recording_sid}{ext}"
            try:
                # Check if file exists
                s3_client.head_object(Bucket=S3_BUCKET, Key=s3_key)
                
                # Generate presigned URL (valid for 1 hour)
                url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': S3_BUCKET, 'Key': s3_key},
                    ExpiresIn=3600
                )
                return url
            except s3_client.exceptions.NoSuchKey:
                continue
        
        return None
    except Exception as e:
        print(f"❌ Error getting S3 URL: {e}")
        return None

def list_recordings_for_call(call_sid: str) -> list:
    """
    List all recordings for a call from S3
    
    Args:
        call_sid: Twilio call SID
        
    Returns:
        List of recording metadata
    """
    if not s3_client:
        return []
    
    try:
        prefix = f"recordings/{call_sid}/"
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
        
        recordings = []
        if 'Contents' in response:
            for obj in response['Contents']:
                recordings.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'url': f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{obj['Key']}"
                })
        
        return recordings
    except Exception as e:
        print(f"❌ Error listing recordings: {e}")
        return []

def save_interview_to_s3(call_sid: str, interview_data: dict) -> Optional[str]:
    """
    Save interview data to S3
    
    Args:
        call_sid: Twilio call SID
        interview_data: Interview data dictionary
        
    Returns:
        S3 key if successful, None otherwise
    """
    if not s3_client:
        print("⚠️ S3 client not available. Skipping upload.")
        return None
    
    try:
        import json
        s3_key = f"interviews/{call_sid}.json"
        
        # Convert to JSON string
        json_data = json.dumps(interview_data, indent=2, default=str)
        
        # Upload to S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=json_data.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'call_sid': call_sid,
                'status': interview_data.get('status', 'UNKNOWN'),
                'candidate_name': interview_data.get('candidate_name', 'Unknown')
            }
        )
        
        print(f"✅ Interview saved to S3: {s3_key}")
        return s3_key
        
    except Exception as e:
        print(f"❌ Error saving interview to S3: {e}")
        return None

def load_interview_from_s3(call_sid: str) -> Optional[dict]:
    """
    Load interview data from S3
    
    Args:
        call_sid: Twilio call SID
        
    Returns:
        Interview data dictionary or None
    """
    if not s3_client:
        return None
    
    try:
        import json
        s3_key = f"interviews/{call_sid}.json"
        
        # Try to get object from S3
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        data = json.loads(response['Body'].read().decode('utf-8'))
        
        print(f"✅ Interview loaded from S3: {s3_key}")
        return data
        
    except s3_client.exceptions.NoSuchKey:
        return None
    except Exception as e:
        print(f"❌ Error loading interview from S3: {e}")
        return None

def list_all_interviews_from_s3() -> list:
    """
    List all interviews from S3
    
    Returns:
        List of interview data dictionaries
    """
    if not s3_client:
        return []
    
    try:
        import json
        prefix = "interviews/"
        interviews = []
        
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix)
        
        for page in pages:
            if 'Contents' in page:
                for obj in page['Contents']:
                    key = obj['Key']
                    # Only get interview files, not recordings or analysis
                    if key.endswith('.json') and 'recordings/' not in key and 'JD_ANALYSIS' not in key:
                        try:
                            response = s3_client.get_object(Bucket=S3_BUCKET, Key=key)
                            data = json.loads(response['Body'].read().decode('utf-8'))
                            interviews.append(data)
                        except Exception as e:
                            print(f"Error loading {key}: {e}")
                            continue
        
        return interviews
    except Exception as e:
        print(f"❌ Error listing interviews from S3: {e}")
        return []

def save_jd_analysis_to_s3(call_sid: str, analysis_data: dict) -> Optional[str]:
    """
    Save JD analysis to S3
    
    Args:
        call_sid: Twilio call SID
        analysis_data: Analysis data dictionary
        
    Returns:
        S3 key if successful, None otherwise
    """
    if not s3_client:
        print("⚠️ S3 client not available. Skipping upload.")
        return None
    
    try:
        import json
        s3_key = f"interviews/{call_sid}_JD_ANALYSIS.json"
        
        json_data = json.dumps(analysis_data, indent=2, default=str)
        
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=json_data.encode('utf-8'),
            ContentType='application/json'
        )
        
        print(f"✅ JD Analysis saved to S3: {s3_key}")
        return s3_key
        
    except Exception as e:
        print(f"❌ Error saving JD analysis to S3: {e}")
        return None

def load_jd_analysis_from_s3(call_sid: str) -> Optional[dict]:
    """
    Load JD analysis from S3
    
    Args:
        call_sid: Twilio call SID
        
    Returns:
        Analysis data dictionary or None
    """
    if not s3_client:
        return None
    
    try:
        import json
        s3_key = f"interviews/{call_sid}_JD_ANALYSIS.json"
        
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        data = json.loads(response['Body'].read().decode('utf-8'))
        
        return data
        
    except s3_client.exceptions.NoSuchKey:
        return None
    except Exception as e:
        print(f"❌ Error loading JD analysis from S3: {e}")
        return None

