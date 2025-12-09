"""Twilio call handling and voice responses"""
from twilio.twiml.voice_response import VoiceResponse
from datetime import datetime
from config import WEBHOOK_BASE_URL, INTERVIEW_QUESTIONS, MAX_SILENCE_PROMPTS
from storage import load_interview_session, save_interview_session, save_interview
from interview import validate_response, extract_candidate_name

def ask_next_question(call_sid: str, question_index: int) -> str:
    """Generate TwiML for next question"""
    try:
        if question_index >= len(INTERVIEW_QUESTIONS):
            return complete_interview(call_sid)
        
        question = INTERVIEW_QUESTIONS[question_index]
        resp = VoiceResponse()
        
        if question_index == 1:
            resp.say("Great! Let's begin with our technical interview.", voice='Polly.Aditi', rate='medium')
            resp.pause(length=0.5)
        elif question_index > 1:
            resp.say("Next question:", voice='Polly.Aditi', rate='medium')
            resp.pause(length=0.2)
        
        resp.say(question, voice='Polly.Aditi', rate='medium')
        
        resp.gather(
            input='speech',
            action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
            method='POST',
            speechTimeout='auto',
            timeout='6',
            language='en-IN',
            enhanced=True,
            profanityFilter=False,
            speechModel='phone_calls'
        )
        
        resp.redirect(f'{WEBHOOK_BASE_URL}/voice/no-response/{call_sid}')
        return str(resp)
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ASK QUESTION ERROR] Question {question_index}: {e}")
        print(f"[ASK QUESTION ERROR TRACEBACK]\n{error_trace}")
        return handle_error("Sorry, there was an error with the question.")

def handle_no_response(call_sid: str) -> str:
    """Handle no response from candidate"""
    try:
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            return handle_error("Interview session not found")
        
        silence_prompts = interview_data.get('silence_prompts', 0)
        current_question = interview_data.get('current_question', 0)
        
        if silence_prompts >= MAX_SILENCE_PROMPTS:
            resp = VoiceResponse()
            resp.say("Thank you for your time. We'll be in touch soon.", voice='Polly.Aditi')
            resp.hangup()
            
            interview_data['status'] = 'INCOMPLETE_SILENCE'
            interview_data['end_time'] = datetime.now().isoformat()
            save_interview(call_sid, interview_data)
            return str(resp)
        
        interview_data['silence_prompts'] = silence_prompts + 1
        save_interview_session(call_sid, interview_data)
        
        resp = VoiceResponse()
        resp.say("Please respond to the question.", voice='Polly.Aditi', rate='medium')
        
        if current_question < len(INTERVIEW_QUESTIONS):
            resp.pause(length=0.3)
            resp.say(INTERVIEW_QUESTIONS[current_question], voice='Polly.Aditi', rate='medium')
            resp.gather(
                input='speech',
                action=f'{WEBHOOK_BASE_URL}/voice/speech/{call_sid}',
                method='POST',
                speechTimeout='auto',
                timeout='6',
                language='en-IN',
                enhanced=True,
                profanityFilter=False,
                speechModel='phone_calls'
            )
            resp.redirect(f'{WEBHOOK_BASE_URL}/voice/no-response/{call_sid}')
        
        return str(resp)
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[NO RESPONSE HANDLER ERROR] {e}")
        print(f"[NO RESPONSE HANDLER ERROR TRACEBACK]\n{error_trace}")
        return handle_error("Technical difficulty occurred.")

def complete_interview(call_sid: str) -> str:
    """Complete interview and save results"""
    try:
        interview_data = load_interview_session(call_sid)
        if not interview_data:
            interview_data = {
                "interview_id": call_sid,
                "call_sid": call_sid,
                "responses": [],
                "status": "COMPLETED",
                "start_time": datetime.now().isoformat(),
                "phone_number": "",
                "candidate_name": f"Candidate_{call_sid[-8:]}"
            }
        
        responses = interview_data.get("responses", [])
        
        # Extract name from responses if not set
        candidate_name = interview_data.get("candidate_name", "")
        if not candidate_name or candidate_name.startswith("Candidate_"):
            candidate_name = extract_candidate_name(responses, call_sid)
            interview_data["candidate_name"] = candidate_name
        
        # Save completed interview
        interview_data["status"] = "COMPLETED"
        save_interview(call_sid, interview_data)
        
        # Trigger analysis in background
        try:
            from summary import run_jd_analysis
            from concurrent.futures import ThreadPoolExecutor
            executor = ThreadPoolExecutor(max_workers=1)
            executor.submit(run_jd_analysis)
        except Exception as e:
            print(f"Failed to run analysis: {e}")
        
        resp = VoiceResponse()
        resp.say("Thank you for your time! Your interview has been completed successfully. We will review your responses and get back to you soon. Have a great day!", voice='Polly.Aditi')
        resp.hangup()
        return str(resp)
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[COMPLETE INTERVIEW ERROR] {e}")
        print(f"[COMPLETE INTERVIEW ERROR TRACEBACK]\n{error_trace}")
        resp = VoiceResponse()
        resp.say("Thank you for your time! We'll be in touch soon. Have a great day!", voice='Polly.Aditi')
        resp.hangup()
        return str(resp)

def handle_error(message: str) -> str:
    """Generate error response"""
    try:
        resp = VoiceResponse()
        resp.say(message, voice='Polly.Aditi')
        resp.hangup()
        return str(resp)
    except Exception as e:
        print(f"Error in handle_error: {e}")
        return '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi">Sorry, there was an error. Goodbye.</Say><Hangup/>'
