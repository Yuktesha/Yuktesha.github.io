/**
 * 字戀 (WordChain) - [第三章] 詞海八字 · 職業神算 (Career Divination Engine)
 * 職責：
 * 1. 玩家出招詞海特徵向量分析（科技、電信、ICU急救、醫學、運將、法政、財經、營造、設計、教育、文學）
 * 2. 臺灣科學園區定位推測彩蛋（竹科、內科、汐科、中科、南科）
 * 3. 結合 career_database.js 百工百業籤詩庫動態占卜
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.Career = factory();
    Object.assign(root, root.WordChain.Career);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let userTechPark = "竹科";

  function detectUserTechPark(callback = null) {
    try {
      const savedPark = localStorage.getItem("wordchain_user_tech_park");
      if (savedPark) {
        userTechPark = savedPark;
        if (callback) callback(userTechPark);
      }
    } catch {}

    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const PARKS = [
          { name: "竹科", lat: 24.77, lng: 121.01, descSuffix: "新竹科學園區頂尖工程師" },
          { name: "內科", lat: 25.08, lng: 121.57, descSuffix: "內湖科學園區（內科）演算法高手" },
          { name: "汐科", lat: 25.06, lng: 121.65, descSuffix: "汐止科學園區（汐科）資深硬核架構師" },
          { name: "中科", lat: 24.21, lng: 120.61, descSuffix: "中部科學園區（中科）精密製程大師" },
          { name: "南科", lat: 23.11, lng: 120.28, descSuffix: "南部科學園區（南科）先進半導體巨擘" },
        ];

        let minDis = 999999;
        let nearestPark = "竹科";
        PARKS.forEach(p => {
          const d = Math.hypot(lat - p.lat, lng - p.lng);
          if (d < minDis) {
            minDis = d;
            nearestPark = p.name;
          }
        });

        if (minDis <= 0.65) {
          userTechPark = nearestPark;
          try { localStorage.setItem("wordchain_user_tech_park", nearestPark); } catch {}
          if (callback) callback(userTechPark);
        }
      },
      (err) => {
        // 使用者未授權或超時，保持竹科/內科等合理預設
      },
      { timeout: 8000, maximumAge: 3600000 }
    );
  }

  function divineCareer(words = [], explicitPark = null) {
    const effectivePark = explicitPark || userTechPark || "竹科";

    if (!words || words.length === 0) {
      return {
        tag: "文壇初試 · 璞玉渾金",
        title: "深不可測的初入江湖隱士！",
        desc: "落子雖簡，字骨清奇；尚未完全展露真實行業神通，下一局且看閣下大顯身手！"
      };
    }

    const allText = words.join(" ");

    let techScore = 0;
    let telecomScore = 0;
    let icuScore = 0;
    let medScore = 0;
    let driverScore = 0;
    let legalScore = 0;
    let finScore = 0;
    let civilScore = 0;
    let mktScore = 0;
    let chefScore = 0;
    let designScore = 0;
    let eduScore = 0;
    let litScore = 0;

    const TECH_KWS = ["晶片", "半導體", "電路", "積體", "演算法", "計算機", "伺服器", "記憶體", "資料庫", "程式", "軟體", "硬體", "微處理", "代碼", "機器學習", "人工智慧", "數據", "數位", "編碼", "邏輯", "架構", "除錯", "變數", "函式", "系統", "工程師", "電子", "資訊", "雲端", "運算", "終端"];
    const TELECOM_KWS = ["光纖", "訊號", "頻寬", "介面", "傳輸", "電信", "基站", "天線", "通訊", "基地台", "光纜", "電纜", "路由", "光電", "波長", "信道", "寬頻", "通訊協定", "微波", "射頻", "局端"];
    const ICU_KWS = ["加護", "急救", "插管", "心肺", "葉克膜", "敗血", "休克", "甦醒", "重症", "加護病房", "點滴", "心律", "監護", "生命徵象", "抗體", "引流", "氣切", "導管", "呼吸器", "護理", "護理師"];
    const MED_KWS = ["心肌", "免疫", "神經", "血小板", "動脈", "靜脈", "抗生素", "病理", "臨床", "診斷", "處方", "染色體", "內分泌", "外科", "內科", "阿斯匹靈", "病毒", "細胞", "基因", "酵素", "腫瘤", "血壓", "血糖", "疫苗", "膠囊", "藥劑", "生理", "解剖", "組織", "器官", "血液", "細菌", "感染", "代謝", "醫生", "醫師", "藥師"];
    const DRIVER_KWS = ["運將", "計程車", "導航", "超車", "快車道", "慢車道", "迴轉", "收費站", "交流道", "國道", "省道", "平交道", "煞車", "油門", "里程", "轉運", "紅綠燈", "斑馬線", "乘客", "車牌", "司機", "老司機", "公車", "捷運", "高鐵", "班車", "客運", "交通", "載客", "排班"];
    const LEGAL_KWS = ["訴訟", "刑事", "民事", "賠償", "處分", "合約", "契約", "原告", "被告", "法官", "律師", "違憲", "違法", "法人", "誠信", "不可抗力", "答辯", "起訴", "上訴", "條例", "憲法", "法規", "裁判", "判決", "損害", "公證", "代理", "罪刑", "審判", "仲裁", "管轄", "抗辯", "證據", "認證"];
    const FIN_KWS = ["通膨", "膨脹", "投資", "報酬", "流動性", "資產", "負債", "避險", "貨幣", "資本", "殖利率", "外匯", "股市", "融資", "融券", "債券", "基金", "利息", "利率", "證券", "期貨", "營收", "獲利", "股權", "估值", "槓桿", "套利", "籌碼", "大盤", "指數", "匯率", "金融", "信貸", "財經"];
    const CIVIL_KWS = ["混凝土", "鋼筋", "力學", "結構", "地基", "透視", "承重", "營造", "樑柱", "灌漿", "鷹架", "都市", "建築", "砌磚", "工法", "基樁", "耐震", "工程", "土木", "測量", "鋼骨"];
    const MKT_KWS = ["流量", "行銷", "品牌", "社群", "推廣", "爆款", "文案", "轉換", "點閱", "觸及", "粉專", "宣傳", "受眾", "公關", "話題", "曝光", "網紅"];
    const CHEF_KWS = ["火候", "調味", "燉煮", "烘焙", "香料", "食材", "料理", "煨", "爆炒", "慢火", "煨湯", "高湯", "醬汁", "主廚", "廚藝", "佳餚", "饕客", "烹飪", "酸甜", "香氣", "擺盤"];
    const DESIGN_KWS = ["排版", "字型", "對齊", "配色", "對比", "向量", "像素", "色票", "美感", "留白", "比例", "構圖", "透視", "層次", "筆畫", "視覺", "修圖", "質感", "手繪", "設計師"];
    const EDU_KWS = ["作育", "英才", "教案", "考卷", "備課", "訓導", "啟發", "板書", "講義", "作業", "學分", "答辯", "作答", "批改", "導師", "教授", "諄諄教誨", "循循善誘", "教學", "課堂"];

    TECH_KWS.forEach(k => { if (allText.includes(k)) techScore += 2; });
    TELECOM_KWS.forEach(k => { if (allText.includes(k)) telecomScore += 2.5; });
    ICU_KWS.forEach(k => { if (allText.includes(k)) icuScore += 2.5; });
    MED_KWS.forEach(k => { if (allText.includes(k)) medScore += 2; });
    DRIVER_KWS.forEach(k => { if (allText.includes(k)) driverScore += 2.5; });
    LEGAL_KWS.forEach(k => { if (allText.includes(k)) legalScore += 2; });
    FIN_KWS.forEach(k => { if (allText.includes(k)) finScore += 2; });
    CIVIL_KWS.forEach(k => { if (allText.includes(k)) civilScore += 2; });
    MKT_KWS.forEach(k => { if (allText.includes(k)) mktScore += 2; });
    CHEF_KWS.forEach(k => { if (allText.includes(k)) chefScore += 2.5; });
    DESIGN_KWS.forEach(k => { if (allText.includes(k)) designScore += 2.5; });
    EDU_KWS.forEach(k => { if (allText.includes(k)) eduScore += 2.5; });

    words.forEach(w => {
      if (typeof window !== 'undefined') {
        if (window.STORY_CACHE && window.STORY_CACHE[w]) litScore += 2;
      }
      if (w.length >= 5) litScore += 3;
    });

    // 優先比對百工百業擴充星盤庫
    if (typeof window !== 'undefined' && window.CAREER_DATABASE && Array.isArray(window.CAREER_DATABASE)) {
      let bestCareerMatch = null;
      let maxMatchScore = 0;

      window.CAREER_DATABASE.forEach(item => {
        let matchCount = 0;
        if (item.keywords && Array.isArray(item.keywords)) {
          item.keywords.forEach(k => {
            if (allText.includes(k)) matchCount += 2.5;
          });
        }
        if (matchCount > maxMatchScore) {
          maxMatchScore = matchCount;
          bestCareerMatch = item;
        }
      });

      if (bestCareerMatch && maxMatchScore >= 2.5) {
        return {
          tag: bestCareerMatch.tag,
          title: bestCareerMatch.title,
          desc: bestCareerMatch.desc
        };
      }
    }

    const scores = [
      { domain: "telecom", score: telecomScore },
      { domain: "icu", score: icuScore },
      { domain: "driver", score: driverScore },
      { domain: "chef", score: chefScore },
      { domain: "design", score: designScore },
      { domain: "edu", score: eduScore },
      { domain: "tech", score: techScore },
      { domain: "med", score: medScore },
      { domain: "legal", score: legalScore },
      { domain: "fin", score: finScore },
      { domain: "civil", score: civilScore },
      { domain: "mkt", score: mktScore }
    ];
    scores.sort((a, b) => b.score - a.score);

    const topDomain = scores[0];

    if (topDomain.score >= 2) {
      if (topDomain.domain === "telecom") {
        return {
          tag: "📡 烽火星盤 · 詩書若纜",
          title: "詩書若纜——閣下該不是飛天遁地的資深電信工程師吧？",
          desc: "光纖為脈、訊號連天，出招佈線如百萬兆寬頻般高速穿透，任何字陣網絡障礙瞬間打通！"
        };
      } else if (topDomain.domain === "icu") {
        return {
          tag: "❤️ 仁心星盤 · 熱血守護",
          title: "滿腔熱血——閣下莫非是日夜守護生命線的 ICU 護理師？",
          desc: "反應極速、臨危不亂，任憑局面多麼凶險，總能一招插管給氧、起死回生絕地大逆轉！"
        };
      } else if (topDomain.domain === "driver") {
        return {
          tag: "🚕 馳騁星盤 · 運將豪傑",
          title: "滿腹經綸運匠大哥大——穿梭千街萬巷的文壇老司機！",
          desc: "四通八達、路況如指掌，超車變道瀟灑自如，帶領對手在詞海大街小巷兜風直接抵達終點！"
        };
      } else if (topDomain.domain === "chef") {
        return {
          tag: "🍳 珍饈星盤 · 國宴大廚",
          title: "文思入味、火候精準——閣下該不會是摘星無數的頂級料理長吧？",
          desc: "咬字有味、調和五音，落子猶如大火爆炒與文火慢燉相得益彰，端出一盤盤色香味俱全的字陣盛宴！"
        };
      } else if (topDomain.domain === "design") {
        return {
          tag: "🎨 丹青星盤 · 視覺巨匠",
          title: "點線面皆成章——閣下定是美感超群的資深字體或視覺設計師！",
          desc: "棋盤縱橫兼顧黃金比例與留白韻律，出招字形優雅端莊，連錯位銜接都充滿強烈視覺張力！"
        };
      } else if (topDomain.domain === "edu") {
        return {
          tag: "🍎 鐸聲星盤 · 杏壇名師",
          title: "諄諄善誘、作育英才——閣下莫非是文壇名校的王牌名師？",
          desc: "出招條理分明如教科書示範，信手拈來皆是標準教案，對弈之間早已將對手循循善誘引入深奧學海！"
        };
      } else if (topDomain.domain === "tech") {
        const parkName = effectivePark;
        let parkDesc = "字裡行間半導體、晶片與演算法之氣場濃烈，若非科學園區科技大老，定是隱世全棧架構師！";
        if (parkName === "內科") {
          parkDesc = "字裡行間滿溢網路雲端與軟體架構之氣場，兼具內科（內湖科學園區）頂尖軟體大師風範！";
        } else if (parkName === "汐科") {
          parkDesc = "出招嚴謹如資通訊與硬體資安協定，渾身散發汐科（汐止科學園區）硬核高手氣場！";
        } else if (parkName === "南科") {
          parkDesc = "落子精度宛如 2nm 先進製程，深藏南部科學園區（南科）晶圓級強悍實力！";
        } else if (parkName === "中科") {
          parkDesc = "招招緊湊精準如高階精密光電，具備中部科學園區（中科）大匠之風！";
        }

        return {
          tag: `💻 ${parkName}星盤 · 科技極客`,
          title: `您該不是被詩詞耽誤的${parkName}工程師吧？XD`,
          desc: parkDesc
        };
      } else if (topDomain.domain === "med") {
        return {
          tag: "🩺 杏林星盤 · 名醫聖手",
          title: "落子如切脈施針——閣下莫非是醫學中心的隱世神醫？",
          desc: "診斷精確、出手如手術刀般游刃有餘，文壇對弈竟透著頂尖名醫之沉著氣度！"
        };
      } else if (topDomain.domain === "legal") {
        return {
          tag: "⚖️ 法政星盤 · 王牌大狀",
          title: "字字千鈞、滴水不漏——閣下該不是剛打贏勝訴官司的王牌大律師吧？",
          desc: "法理分明、條例嚴謹、邏輯如銅牆鐵壁，對手稍有漏洞即被當庭依法絕殺！"
        };
      } else if (topDomain.domain === "fin") {
        return {
          tag: "📈 財經星盤 · 華爾街之狼",
          title: "盤面槓桿算盡——閣下莫非是縱橫外資圈的操盤高手？",
          desc: "出招皆在精準調度流動性與避險籌碼，每一步接龍都在計算最高的投資報酬率！"
        };
      } else if (topDomain.domain === "civil") {
        return {
          tag: "🏛️ 營造星盤 · 結構大師",
          title: "字陣縱橫穩如泰山——閣下該不會是國家級建築大師或結構技師吧？",
          desc: "二維字陣交錯咬合、力學結構滴水不漏，連紀曉嵐都讚嘆此乃神級營造工法！"
        };
      } else if (topDomain.domain === "mkt") {
        return {
          tag: "📢 傳播星盤 · 社群鬼才",
          title: "字字直擊痛點——閣下定是操盤千萬爆款的社群行銷操盤手！",
          desc: "出招自帶百萬流量密碼與轉發衝動，連出成語都在做文案 A/B Testing！"
        };
      }
    }

    if (litScore >= 5 || (litScore / (words.length * 2 || 1)) >= 0.5) {
      return {
        tag: "🎓 翰林星盤 · 當代詞宗",
        title: "滿腹經綸、氣吞山河——閣下莫非是文學院客座教授或文曲星轉世？",
        desc: "經史子集、唐詩宋詞信手拈來，四庫全書信手翻閱，風雅絕代，名士太白亦甘拜下風！"
      };
    }

    return {
      tag: "🌈 無雙星盤 · 跨界博學",
      title: "博古通今、跨界無雙——閣下定是無所不知的跨領域大斜槓奇才！",
      desc: "上通科技天文、下達律法經世，兼修文史藝術，出招路數神鬼莫測，堪稱文壇全能通才！"
    };
  }

  return {
    detectUserTechPark,
    divineCareer,
    getUserTechPark: () => userTechPark,
    setUserTechPark: (p) => { userTechPark = p; }
  };
});
