import argparse
import glob
import json
import os
import re
import sys
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

GEMMA_SYSTEM_PROMPT = """你是一位深諳中華文史典故與古典辭書編纂的「教育部國語文學院士審查委員」。
我們正在為一款講究正統臺灣正體漢字美學的二維接龍博弈遊戲《字戀》審核對戰詞庫。
AI 選手（詩仙李白、四庫總纂官紀曉嵐）在對局中應當出招典雅，展現詩才、成語底蘊與修辭之美。

請逐一審查以下候選詞目（附教育部辭典釋義與典籍引文），判定其是否適合作為文壇接龍對弈詞彙：

【判定合格 (APPROVE)】：
- 經史子集古典成語、歷久彌新之名句、文思高雅且寓意完整的正統辭目（如「天馬行空」、「海闊天空」、「臥薪嘗膽」）。
- 具有清晰隱喻、比喻或成語定型結構之詞彙。

【判定剔除 (REJECT)】：
- 清末民初瑣碎口語、無關緊要之小說雜物/髮型/服飾碎詞（如「打前劉海」）。
- 現代技術/公務/行政複合名詞（如「海洋開發」、「行政處分」、「發音器官」）。
- 機械拼接、斷句不全、語意殘缺或俚俗之用語。

請嚴格僅輸出標準 JSON 陣列，不得包含額外客套寒暄，格式範例：
[
  {
    "word": "海闊天空",
    "verdict": "APPROVE",
    "reason": "經典古典成語，形容心胸開闊或天地遼闊"
  },
  {
    "word": "打前劉海",
    "verdict": "REJECT",
    "reason": "清末小說瑣碎髮型口語，非成語，不宜作為文壇對弈詞彙"
  }
]
"""

def create_prompt_for_batch(batch):
    content = "請審查以下候選詞目：\n\n"
    for idx, item in enumerate(batch, 1):
        w = item.get('word', '')
        d = item.get('def', '（無教育部釋義）')
        q = item.get('quote', '')
        quote_str = f" | 典籍引文: {q}" if q else ""
        content += f"{idx}. 【{w}】 釋義: {d}{quote_str}\n"
    return content

def call_ollama(prompt, model='gemma2:9b', host='http://127.0.0.1:11434'):
    url = f"{host}/api/generate"
    payload = {
        "model": model,
        "system": GEMMA_SYSTEM_PROMPT,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        return result.get('response', '')

def call_gemini_api(prompt, api_key, model='gemini-2.0-flash'):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": GEMMA_SYSTEM_PROMPT + "\n\n" + prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        cands = result.get('candidates', [])
        if cands:
            return cands[0].get('content', {}).get('parts', [{}])[0].get('text', '')
    return ''

def parse_json_from_response(raw_text):
    text = raw_text.strip()
    match = re.search(r'```(?:json)?\s*(\[.*?\])\s*```', text, re.DOTALL)
    if match:
        text = match.group(1)
    else:
        match_bracket = re.search(r'(\[.*?\])', text, re.DOTALL)
        if match_bracket:
            text = match_bracket.group(1)
    try:
        return json.loads(text)
    except Exception as e:
        print(f'    ⚠️ JSON 解析失敗: {e}')
        return []

def run_export_prompts(candidates, batch_size=25, out_dir='gemma_prompts'):
    prompts_dir = os.path.join(BASE_DIR, out_dir)
    os.makedirs(prompts_dir, exist_ok=True)
    
    total = len(candidates)
    num_batches = (total + batch_size - 1) // batch_size
    print(f'>>> 正在將 {total:,} 條候選詞目切分為 {num_batches} 個審查任務 Prompt...')
    
    for i in range(num_batches):
        batch = candidates[i * batch_size : (i + 1) * batch_size]
        prompt_content = f"# Gemma 詞海審查任務 - Batch {i+1:03d}/{num_batches:03d}\n\n"
        prompt_content += GEMMA_SYSTEM_PROMPT + "\n\n"
        prompt_content += create_prompt_for_batch(batch)
        
        file_path = os.path.join(prompts_dir, f'batch_{i+1:03d}.md')
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(prompt_content)
            
    print(f'🎉 所有 Prompt 已寫入目錄: {prompts_dir}')
    print(f'💡 您可將這些檔案內容直接貼至任何 Gemma/AI 對話視窗，並將回覆存入 gemma_results/ 目錄！')

def run_import_results(input_path):
    all_verdicts = []
    target_path = os.path.abspath(input_path)
    
    if os.path.isdir(target_path):
        files = glob.glob(os.path.join(target_path, '*.json')) + glob.glob(os.path.join(target_path, '*.txt'))
    else:
        files = [target_path]
        
    print(f'>>> 正在解析審查結果檔案: 共 {len(files)} 個檔案...')
    for fpath in files:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
            items = parse_json_from_response(content)
            all_verdicts.extend(items)
            
    update_rejected_words(all_verdicts)

def update_rejected_words(verdicts):
    rejected_path = os.path.join(BASE_DIR, 'rejected_words.json')
    current_rejected = {}
    if os.path.exists(rejected_path):
        try:
            with open(rejected_path, 'r', encoding='utf-8') as f:
                current_rejected = json.load(f)
        except Exception:
            current_rejected = {}
            
    new_rejects = 0
    new_approved = 0
    for item in verdicts:
        w = item.get('word', '').strip()
        v = item.get('verdict', '').upper()
        r = item.get('reason', '').strip()
        if not w:
            continue
        if v == 'REJECT':
            current_rejected[w] = r or 'Gemma 判定不合適詞彙'
            new_rejects += 1
        elif v == 'APPROVE':
            new_approved += 1
            if w in current_rejected:
                del current_rejected[w]
                
    with open(rejected_path, 'w', encoding='utf-8') as f:
        json.dump(current_rejected, f, ensure_ascii=False, indent=2)
        
    print(f'🎉 審查成果已更新至 {rejected_path}！')
    print(f'    - 本次判定合格: {new_approved:,} 條')
    print(f'    - 本次判定剔除: {new_rejects:,} 條')
    print(f'    - 總黑名單收錄剔除詞總數: {len(current_rejected):,} 條')
    print(f'💡 提示：執行 python build_moedict_lexicon.py 即可將這些剔除詞自動排除！')

def main():
    parser = argparse.ArgumentParser(description='WordChain Gemma Lexicon Auditor')
    parser.add_argument('--input', type=str, default='audit_candidates.json', help='輸入候選詞清單檔案 (預設 audit_candidates.json)')
    parser.add_argument('--engine', type=str, choices=['ollama', 'api', 'export', 'import'], default='export', help='執行模式：ollama (本地服務) | api (Gemini/Gemma API) | export (導出 Prompt) | import (匯入審查結果)')
    parser.add_argument('--model', type=str, default='gemma2:9b', help='模型名稱 (預設 gemma2:9b 或 gemini-2.0-flash)')
    parser.add_argument('--ollama-url', type=str, default='http://127.0.0.1:11434', help='Ollama 服務位址')
    parser.add_argument('--api-key', type=str, default='', help='Google API Key (亦可由 GEMINI_API_KEY 環境變數讀取)')
    parser.add_argument('--import-file', type=str, default='', help='匯入審查結果 JSON 或檔案目錄')
    parser.add_argument('--limit', type=int, default=0, help='限制審查詞彙數量 (0 為全部)')
    parser.add_argument('--batch-size', type=int, default=20, help='每批審查詞數 (預設 20)')
    args = parser.parse_args()

    if args.engine == 'import':
        if not args.import_file:
            print('❌ 請使用 --import-file 指定審查結果檔案或目錄！')
            sys.exit(1)
        run_import_results(args.import_file)
        return

    cand_path = os.path.join(BASE_DIR, args.input)
    if not os.path.exists(cand_path):
        print(f'❌ 找不到候選詞檔案: {cand_path}，請先執行 python simulate_battles.py 生成！')
        sys.exit(1)
        
    with open(cand_path, 'r', encoding='utf-8') as f:
        candidates = json.load(f)
        
    if args.limit > 0:
        candidates = candidates[:args.limit]
        
    print(f'>>> 已載入 {len(candidates):,} 條待審查詞目...')

    if args.engine == 'export':
        run_export_prompts(candidates, batch_size=args.batch_size)
    elif args.engine == 'ollama':
        print(f'>>> 正在透過本地 Ollama ({args.model} @ {args.ollama_url}) 執行智慧審查...')
        all_verdicts = []
        num_batches = (len(candidates) + args.batch_size - 1) // args.batch_size
        for i in range(num_batches):
            batch = candidates[i * args.batch_size : (i + 1) * args.batch_size]
            prompt = create_prompt_for_batch(batch)
            print(f'    正在審查第 {i+1}/{num_batches} 批 ({len(batch)} 詞)...')
            try:
                resp = call_ollama(prompt, model=args.model, host=args.ollama_url)
                items = parse_json_from_response(resp)
                all_verdicts.extend(items)
                print(f'        [OK] 本批回傳 {len(items)} 條判定')
            except Exception as e:
                print(f'        ❌ Ollama 呼叫失敗: {e}')
        update_rejected_words(all_verdicts)
    elif args.engine == 'api':
        api_key = args.api_key or os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
        if not api_key:
            print('❌ 請提供 --api-key 或設定 GEMINI_API_KEY 環境變數！')
            sys.exit(1)
        print(f'>>> 正在透過 Google GenAI API ({args.model}) 執行批量審查...')
        all_verdicts = []
        num_batches = (len(candidates) + args.batch_size - 1) // args.batch_size
        for i in range(num_batches):
            batch = candidates[i * args.batch_size : (i + 1) * args.batch_size]
            prompt = create_prompt_for_batch(batch)
            print(f'    正在審查第 {i+1}/{num_batches} 批 ({len(batch)} 詞)...')
            try:
                resp = call_gemini_api(prompt, api_key=api_key, model=args.model)
                items = parse_json_from_response(resp)
                all_verdicts.extend(items)
                print(f'        [OK] 本批回傳 {len(items)} 條判定')
            except Exception as e:
                print(f'        ❌ API 呼叫失敗: {e}')
        update_rejected_words(all_verdicts)

if __name__ == '__main__':
    main()
