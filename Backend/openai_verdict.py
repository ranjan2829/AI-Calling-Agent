"""OpenAI integration for candidate verdicts"""
import json
from typing import Dict, List
from config import OPENAI_API_KEY

def get_openai_verdict(responses: List[Dict], jd_data: Dict, matched_skills: List[str], overall_score: float) -> Dict[str, str]:
    """Get AI verdict from OpenAI"""
    try:
        from openai import OpenAI
        
        if not OPENAI_API_KEY:
            return {"verdict": "N/A", "reason": "OpenAI API key not configured"}
        
        client = OpenAI(api_key=OPENAI_API_KEY)
        
        full_transcript = " ".join([r.get('answer', '') for r in responses])
        jd_skills = ", ".join(jd_data.get("required_skills", []))
        missing_skills = [s for s in jd_data.get("required_skills", []) if s not in matched_skills]
        
        prompt = f"""Analyze this candidate interview and provide a hiring verdict.

Job Description:
Title: {jd_data.get('title', 'N/A')}
Company: {jd_data.get('company', 'N/A')}
Required Skills: {jd_skills}
Experience Required: {jd_data.get('experience_required', 'N/A')}

Candidate Interview Transcript:
{full_transcript}

Analysis Results:
- Overall Match Score: {overall_score}%
- Matched Skills ({len(matched_skills)}/{len(jd_data.get('required_skills', []))}): {', '.join(matched_skills) if matched_skills else 'None'}
- Missing Skills: {', '.join(missing_skills) if missing_skills else 'None'}

Provide a concise hiring verdict in this exact JSON format:
{{
    "verdict": "STRONG HIRE" | "RECOMMENDED" | "CONSIDER" | "MAYBE" | "NOT RECOMMENDED",
    "reason": "Brief 2-3 sentence explanation of your verdict"
}}

Only return valid JSON, no other text."""
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert technical recruiter analyzing candidate interviews. Provide objective, data-driven hiring verdicts."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=200
        )
        
        verdict_text = response.choices[0].message.content.strip()
        # Remove markdown code blocks if present
        if verdict_text.startswith("```"):
            verdict_text = verdict_text.split("```")[1]
            if verdict_text.startswith("json"):
                verdict_text = verdict_text[4:]
        verdict_text = verdict_text.strip()
        
        verdict_data = json.loads(verdict_text)
        return verdict_data
        
    except ImportError:
        return {"verdict": "N/A", "reason": "OpenAI library not installed"}
    except json.JSONDecodeError as e:
        print(f"⚠️ OpenAI JSON decode error: {e}")
        return {"verdict": "N/A", "reason": "Failed to parse AI response"}
    except Exception as e:
        print(f"⚠️ OpenAI verdict error: {e}")
        return {"verdict": "N/A", "reason": f"Error: {str(e)}"}

