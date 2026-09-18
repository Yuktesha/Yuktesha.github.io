import argparse
import json
import lzma
import os
import random
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def parse_zhuyin_base(zh):
    if not zh:
        return ''
    return re.sub(r'[ˊˇˋ˙]', '', zh)

def load_resources():
    print('>>> 正在載入神譜詞庫與教育部音讀資料...')
    lex_path = os.path.join(BASE_DIR, 'lexicon_scored.json')
    zh_path = os.path.join(BASE_DIR, 'zhuyin_map.json')
    
    with open(lex_path, 'r', encoding='utf-8') as f:
        lexicon = json.load(f)
    with open(zh_path, 'r', encoding='utf-8') as f:
        zhuyin_map = json.load(f)
        
    print(f'    神譜首字索引數: {len(lexicon):,}，音讀字數: {len(zhuyin_map):,}')
    print('    正在建立聲韻拓撲同音直查索引 (O(1) 瞬時查詢)...')
    homo_entries_by_base = {}
    for hc, data in lexicon.items():
        entry = zhuyin_map.get(hc)
        if not entry:
            continue
        readings = entry[2] if len(entry) >= 3 and isinstance(entry[2], list) else [[entry[0], entry[1]]]
        seen_bases = set()
        for bp, _ in readings:
            base = parse_zhuyin_base(bp)
            if base and base not in seen_bases:
                seen_bases.add(base)
                if base not in homo_entries_by_base:
                    homo_entries_by_base[base] = []
                homo_entries_by_base[base].extend(data.get('w', []))

    # 預先對每個 base 注音母音池完成權重出度排序與去重
    for base in homo_entries_by_base:
        seen_w = set()
        unique_entries = []
        for e in homo_entries_by_base[base]:
            if e[0] not in seen_w:
                seen_w.add(e[0])
                unique_entries.append(e)
        unique_entries.sort(key=lambda x: (x[3], x[2]), reverse=True)
        homo_entries_by_base[base] = unique_entries

    # 載入辭典定義資料
    moe_dict = {}
    dict_xz = os.path.join(BASE_DIR, 'dict-revised.json.xz')
    if os.path.exists(dict_xz):
        print('    正在自本地萌典提取詞意釋義...')
        with open(dict_xz, 'rb') as f:
            decomp = lzma.decompress(f.read())
            moe_data = json.loads(decomp.decode('utf-8'))
            for item in moe_data:
                t = item.get('title', '')
                if t and t not in moe_dict:
                    hets = item.get('heteronyms', [])
                    defs = hets[0].get('definitions', []) if hets else []
                    def_text = defs[0].get('def', '').strip() if defs else ''
                    quotes = defs[0].get('quote', []) if hets else []
                    quote_text = quotes[0].strip() if quotes else ''
                    moe_dict[t] = {'def': def_text, 'quote': quote_text}
        print(f'    萌典定義索引收錄: {len(moe_dict):,} 條')
    return lexicon, zhuyin_map, homo_entries_by_base, moe_dict

def get_scored_entries(lexicon, zhuyin_map, homo_entries_by_base, tail_char, allow_homo=True, used_set=None):
    if not tail_char or tail_char not in zhuyin_map:
        return []
    
    if allow_homo:
        target_entry = zhuyin_map.get(tail_char)
        target_readings = target_entry[2] if target_entry and len(target_entry) >= 3 else [[target_entry[0], target_entry[1]]] if target_entry else []
        combined_entries = []
        seen_words = set()
        for bp, _ in target_readings:
            base = parse_zhuyin_base(bp)
            if base in homo_entries_by_base:
                for e in homo_entries_by_base[base]:
                    if e[0] not in seen_words:
                        seen_words.add(e[0])
                        combined_entries.append(e)
        entries = combined_entries
    else:
        entries = lexicon.get(tail_char, {}).get('w', [])

    if used_set:
        candidates = []
        for e in entries:
            if e[0] not in used_set:
                candidates.append(e)
                if len(candidates) >= 10:
                    break
        return candidates

    return entries[:10]

def run_simulation(num_battles=300, max_rounds_per_battle=50):
    lexicon, zhuyin_map, homo_entries_by_base, moe_dict = load_resources()
    
    starters = ['天馬行空', '開門見山', '海闊天空', '乘風破浪', '萬古流芳', '浩然正氣', '龍飛鳳舞', '萬象更新', '心曠神怡', '大顯身手', '博古通今']
    
    battle_logs = []
    word_usage_stats = {}
    
    print(f'\n>>> 開始模擬雙雄對決：共計 {num_battles} 局，每局上限 {max_rounds_per_battle} 步...')
    
    for b_idx in range(1, num_battles + 1):
        starter = random.choice(starters)
        current_word = starter
        used_words = {current_word}
        turns = [{
            'round': 1,
            'speaker': '🚩 系統立題',
            'word': starter,
            'tail': starter[-1]
        }]
        
        if starter not in word_usage_stats:
            word_usage_stats[starter] = {'count': 0, 'battles': set()}
        word_usage_stats[starter]['count'] += 1
        word_usage_stats[starter]['battles'].add(b_idx)
        
        for r in range(2, max_rounds_per_battle + 1):
            speaker = '紀曉嵐' if (r % 2 == 0) else '李白'
            tail_char = current_word[-1]
            entries = get_scored_entries(lexicon, zhuyin_map, homo_entries_by_base, tail_char, allow_homo=True, used_set=used_words)
            
            if not entries:
                break
                
            pool_size = min(len(entries), 5)
            chosen = random.choice(entries[:pool_size])
            next_word = chosen[0]
            
            used_words.add(next_word)
            current_word = next_word
            
            turns.append({
                'round': r,
                'speaker': speaker,
                'word': next_word,
                'tail': next_word[-1],
                'weight': chosen[3],
                'outdeg': chosen[2]
            })
            
            if next_word not in word_usage_stats:
                word_usage_stats[next_word] = {'count': 0, 'battles': set()}
            word_usage_stats[next_word]['count'] += 1
            word_usage_stats[next_word]['battles'].add(b_idx)
            
        battle_logs.append({
            'battle_id': b_idx,
            'total_rounds': len(turns),
            'turns': turns
        })
        
        if b_idx % 100 == 0 or b_idx == num_battles:
            print(f'    已完成 {b_idx}/{num_battles} 局模擬 (累計涵蓋 {len(word_usage_stats):,} 個獨立實戰詞彙)...')
            
    audit_candidates = []
    for w, stat in sorted(word_usage_stats.items(), key=lambda x: x[1]['count'], reverse=True):
        m_info = moe_dict.get(w, {'def': '', 'quote': ''})
        audit_candidates.append({
            'word': w,
            'length': len(w),
            'frequency': stat['count'],
            'battles_count': len(stat['battles']),
            'def': m_info['def'],
            'quote': m_info['quote']
        })
        
    log_out = os.path.join(BASE_DIR, 'demo_battle_log.json')
    cand_out = os.path.join(BASE_DIR, 'audit_candidates.json')
    
    with open(log_out, 'w', encoding='utf-8') as f:
        json.dump(battle_logs, f, ensure_ascii=False, indent=2)
    with open(cand_out, 'w', encoding='utf-8') as f:
        json.dump(audit_candidates, f, ensure_ascii=False, indent=2)
        
    print(f'\n🎉 對弈模擬大功告成！')
    print(f'    - 總模擬對戰場數: {num_battles:,}')
    print(f'    - 實戰使用獨立詞彙量: {len(audit_candidates):,} 條')
    print(f'    - 對戰詳細日誌已寫入: {log_out} ({os.path.getsize(log_out)/1024:.1f} KB)')
    print(f'    - 待審查詞庫清單已寫入: {cand_out} ({os.path.getsize(cand_out)/1024:.1f} KB)')

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='WordChain Battle Simulator')
    parser.add_argument('--battles', type=int, default=300, help='模擬對戰局數 (預設 300)')
    parser.add_argument('--rounds', type=int, default=50, help='每局最大步數 (預設 50)')
    args = parser.parse_args()
    
    run_simulation(args.battles, args.rounds)