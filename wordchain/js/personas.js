/**
 * 字戀 (WordChain) - [第二章] 歷代文人文風與心戰喊話 (Personas & Dialogue Engine)
 * 職責：
 * 1. 歷代文豪個性設定：紀曉嵐（毒舌博學）、李白（豪放詩仙）、包拯（鐵面判官）
 * 2. 依戰局情境（絕殺、險局、長詞、同音借力、同字硬咬、學以致用、開局）生成機鋒對白
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WordChain = root.WordChain || {};
    root.WordChain.Personas = factory();
    Object.assign(root, root.WordChain.Personas);
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PERSONAS = {
    ji_xiaolan: {
      name: "紀曉嵐",
      title: "四庫全書總纂官 · 毒舌博學派",
      icon: "🧐"
    },
    li_bai: {
      name: "李白",
      title: "青蓮劍仙 · 豪放詩仙派",
      icon: "🍶"
    },
    bao_zheng: {
      name: "包拯",
      title: "開封府尹 · 鐵面判官派",
      icon: "⚖️"
    }
  };

  const DIALOGUE_MATRIX = {
    ji_xiaolan: {
      kill: [
        w => `哈哈！老夫此一式【${w}】，退路已盡！閣下這條小舟，已然擱淺在死局淺灘了！`,
        w => `出此【${w}】，落子如封喉利刃。四庫全書翻遍，閣下也尋不出半個生路！`,
        (w, t) => `留你這「${t}」字，天上地下皆無門。且飲杯熱茶，認輸罷休了吧！`,
        w => `一式【${w}】定乾坤！任你三頭六臂，遇此死穴亦回天乏術矣！`
      ],
      danger: [
        (w, t) => `打出【${w}】，前路只剩三兩步羊腸小道。看閣下還能在懸崖邊跳多久！`,
        w => `老夫這手【${w}】可謂敲山震虎，閣下已是泥菩薩過江，自身難保嘍！`,
        (w, t) => `【${w}】留給你的「${t}」字甚險，稍有不慎，便是滿盤皆輸！`,
        w => `前路如履薄冰，老夫這【${w}】可不是隨便出的，閣下小心失足墜崖！`
      ],
      long: [
        w => `洋洋灑灑【${w}】，文字成藥，既可養生亦可制敵，不知閣下可咽得下？`,
        w => `四庫浩瀚，誰說成語必拘於四字？【${w}】長驅直入，看你如何拆解！`,
        w => `妙筆生花打出【${w}】，此等長句成藥，最是考驗文膽功底！`
      ],
      homo: [
        (w, t, h) => `音通意達！老夫以同音「${h}」借力打力，打出【${w}】，這叫聲東擊西！`,
        w => `音諧韻暢，此乃文人雅趣。這手【${w}】接得巧，老夫且看你如何接唱！`,
        w => `雖非本字，但音律相合。這手【${w}】亦算得上一記奇兵吧！`
      ],
      exact: [
        (w, t, h) => `正本清源，同字直咬！「${h}」字剛勁無比，這招【${w}】堂堂正正！`,
        w => `一絲不苟，直取中宮！老夫這手【${w}】字正腔圓，接招！`,
        (w, t, h) => `咬定「${h}」字不放鬆！【${w}】如秋水長天，閣下接得下來嗎？`
      ],
      learned: [
        w => `【學以致用】「這可是閣下上次教老夫的【${w}】，今日物歸原主，感覺如何？」`,
        w => `現學現賣，信手拈來！閣下親授之【${w}】，威力果然不同凡響！`
      ],
      opening: [
        `文思泉湧，詞海弄潮！敢問閣下——您今天字戀了沒？`,
        `四庫全書在胸，天下文章歸我。閣下今日字戀，可有把握招架？`,
        `請閣下先出招，且看今日文壇，究竟誰能自戀到底、稱霸詞海！`
      ],
      general: [
        w => `接得倒快！不過這【${w}】在四庫全書裡也只能算得中品，且看老夫手段！`,
        w => `哼，這點小把戲，當年和珅都不敢在老夫面前班門弄斧！看招【${w}】！`,
        w => `行家一出手，便知有沒有。這手【${w}】出將去，且看今日文壇誰稱雄！`,
        w => `筆下龍蛇走，紙上風雷疾！這記【${w}】，敬請閣下指教！`,
        w => `文如流水意如雲，這手【${w}】老夫自認平生得意之筆！`
      ]
    },
    li_bai: {
      kill: [
        w => `哈哈哈哈！十步殺一人，千里不留行！李白這手【${w}】，已是絕壁千仞無生路矣！`,
        w => `大鵬一日同風起，一式【${w}】定乾坤！閣下休要掙扎，與我同醉罷休！`,
        w => `杯酒破萬軍，長嘯動山河！這【${w}】乃李某絕命仙劍，閣下氣數已盡！`
      ],
      danger: [
        w => `蜀道之難難於上青天！這記【${w}】出招，閣下前路險如猿猱愁攀！`,
        w => `行路難，多歧路！李某這手【${w}】直逼險境，閣下且小心應對！`,
        (w, t) => `狂風吹倒百花殘，留此「${t}」字若危崖！閣下可還站得穩腳跟？`
      ],
      long: [
        w => `仰天大笑出門去，文字縱橫豈受拘束！長句【${w}】，方顯太白豪放本色！`,
        w => `呼兒將出換美酒，與爾同銷萬古愁！這【${w}】似黃河之水天上下來！`
      ],
      homo: [
        w => `音韻相通，宛若仙樂自天外來！同音打出【${w}】，李某圖的就是個痛快！`,
        w => `詩酒放浪，何必拘泥死板字形？這手【${w}】諧音得趣，當浮一大白！`
      ],
      exact: [
        (w, t, h) => `同字硬咬，金鐵交鳴！「${h}」字鋒芒如青蓮劍出鞘，接招【${w}】！`,
        w => `直擊中宮，力拔山兮！這記【${w}】乃太白正統劍意，痛快！`
      ],
      learned: [
        w => `【仙人借劍】「哈哈！此【${w}】乃閣下昔日所贈佳句，李某今日借花獻佛！」`,
        w => `好詩好句，李白過目不忘！這手【${w}】正是閣下所教，妙哉！`
      ],
      opening: [
        `仰天大笑出門去，我輩豈是蓬蒿人！今日且隨太白，一同字戀三千場！`,
        `人生得意須盡歡，千金散盡還復來！敢問閣下——您今天字戀了沒？`,
        `飛流直下三千尺，文字江山唯我狂！請閣下先行出招！`
      ],
      general: [
        w => `妙哉！當浮一大白！閣下出招頗有仙氣，且看李白這記【${w}】！`,
        w => `興酣落筆搖五嶽，詩成笑傲凌滄洲！且接我這手【${w}】！`,
        w => `花間一壺酒，獨酌無相親。有閣下這般對手，今日痛快至極！出招【${w}】！`,
        w => `飛流直下三千尺，疑是銀河落九天！看劍——【${w}】！`,
        w => `事了拂衣去，深藏身與名！這招【${w}】，閣下可能接招？`
      ]
    },
    bao_zheng: {
      kill: [
        w => `法網恢恢，疏而不漏！本府這記【${w}】乃銅鍘索命，閣下斷無生路！`,
        w => `鐵案如山，生門已鎖！此式【${w}】落定，乾坤朗朗，閣下認輸吧！`,
        w => `死生之界，判然分明！【${w}】如御賜尚方寶劍，立斬所有生機！`
      ],
      danger: [
        w => `擊鼓鳴冤，字字千鈞！這手【${w}】如大堂威武棒，閣下休得心存僥倖！`,
        (w, t) => `明察秋毫！此「${t}」字險象環生，閣下若無良策，休怪本府公事公辦！`,
        w => `堂鼓陣陣，步步緊逼！這招【${w}】直逼要害，閣下已是如坐針氈！`
      ],
      long: [
        w => `律法森嚴，辭章弘遠！五言長句【${w}】，正如判詞宏麗，字字誅心！`,
        w => `文正則意端，這篇【${w}】言之鑿鑿，本府依法出招！`
      ],
      homo: [
        w => `借音斷句，曲直分明！同音取義出【${w}】，公堂博弈亦重通變之智！`,
        w => `聲諧理正，合乎律令！本府這手【${w}】，依法准予接龍！`
      ],
      exact: [
        (w, t, h) => `同字對證，黑白分明！本府以「${h}」字秉公執法，打出【${w}】！`,
        w => `不偏不倚，堂堂正正！這手【${w}】如青天白日，豈容辯駁！`
      ],
      learned: [
        w => `【秉公備案】「閣下前次所呈供之【${w}】，經本府勘驗屬實，今特當庭驗收！」`,
        w => `開誠布公，此【${w}】乃閣下親授，本府秉公引用！`
      ],
      opening: [
        `鐵面無私，文心自照！公堂字海對弈，敢問閣下——您今天字戀了沒？`,
        `公堂博弈，字字有據。請閣下出招，自展風華！`,
        `法度森嚴，筆鋒如刀！且看閣下今日如何字戀破局！`
      ],
      general: [
        w => `公堂之上，豈容兒戲！本府接下此招，還敬【${w}】！`,
        w => `鐵面無私，清風兩袖！且看本府這手【${w}】，接招！`,
        w => `明鏡高懸，照澈文海！這記【${w}】有據可查，請閣下出招！`,
        w => `字斟句酌，案無留牘！本府這記【${w}】，浩然之氣貫徹始終！`,
        w => `法度森嚴，筆鋒如刀！閣下休得慌亂，且對這手【${w}】！`
      ]
    }
  };

  function generateSituationalBanter(personaKey, currentWord, lastWord, strategyNote = "") {
    const P = (typeof window !== 'undefined' && window.WordChain && window.WordChain.Phonetics) || {};
    const cleanWordFn = P.cleanInputWord || (s => (s || "").replace(/[\s\u3000。，！？、；：…—～~·「」『』《》〈〉（）()\[\]{}【】"'“”‘’]+/g, '').trim());
    const getTailCharFn = P.getTailChar || (s => s ? s.slice(-1) : "");
    const getHeadCharFn = P.getHeadChar || (s => s ? s[0] : "");

    const personaDict = DIALOGUE_MATRIX[personaKey] || DIALOGUE_MATRIX["ji_xiaolan"];
    const w = cleanWordFn(currentWord);
    const tailC = getTailCharFn(w);
    const headC = getHeadCharFn(w);
    const lastTail = getTailCharFn(lastWord);

    const isKill = strategyNote.includes("絕殺") || strategyNote.includes("0 步") || strategyNote.includes("一擊");
    const isDanger = strategyNote.includes("險局") || strategyNote.includes("1 步") || strategyNote.includes("2 步") || strategyNote.includes("3 步") || strategyNote.includes("逼殺") || strategyNote.includes("壓迫");
    const isLearned = strategyNote.includes("學以致用");
    const isExact = (headC === lastTail);
    const isLong = (w.length >= 5);

    let pool = personaDict.general;
    if (isLearned) pool = personaDict.learned;
    else if (isKill) pool = personaDict.kill;
    else if (isDanger) pool = personaDict.danger;
    else if (isLong) pool = personaDict.long;
    else if (!isExact) pool = personaDict.homo;
    else if (isExact && Math.random() < 0.6) pool = personaDict.exact;

    const fn = pool[Math.floor(Math.random() * pool.length)];
    return fn(w, tailC, headC);
  }

  return {
    PERSONAS,
    DIALOGUE_MATRIX,
    generateSituationalBanter
  };
});
