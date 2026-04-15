import {Crypto,load} from 'assets://js/lib/cat.js';
let HOST;
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36';
const DefHeader = {'User-Agent': MOBILE_UA};
const KParams = {headers: {'User-Agent': MOBILE_UA},timeout: 5000};
async function init(cfg) {
    try {
        let host = cfg.ext?.host?.trim() || 'https://auete.top';
        HOST = host.replace(/\/$/, '');
        KParams.headers['Referer'] = HOST;
        let parseTimeout = parseInt(cfg.ext?.timeout?.trim(), 10);
        KParams.timeout = parseTimeout > 0 ? parseTimeout : 5000;
        KParams.resHtml = await request(HOST);
    } catch (e) {
        console.error('初始化参数失败：', e.message);
    }
}
async function home(filter) {
    try {
        let resHtml = KParams.resHtml;
        if (!resHtml) throw new Error('源码请求失败');
        let $ = load(resHtml);
        let classes = $('ul.navbar-nav.mr-auto a').get().slice(1,5).map(it=>{
            let $it = $(it);
            let cName = dealStr($it.text(), '分类名');
            let cId = dealStr($it.attr('href')).match(/(\w+)\/index.html/)?.[1] ?? '分类值';
            return {type_name: cName,type_id: cId};
        });
        let filters = {};
        return JSON.stringify({class: classes,filters: filters});
    } catch (e) {
        console.error('获取分类失败：', e.message);
        return JSON.stringify({class: [],filters: {}});
    }
}
async function homeVod() {
    try {
        let resHtml = KParams.resHtml;
        let VODS = getVodList(resHtml);
        return JSON.stringify({list: VODS});
    } catch (e) {
        console.error('推荐页获取失败：', e.message);
        return JSON.stringify({list: []});
    }
}
async function category(tid, pg, filter, extend) {
    try {
        pg = parseInt(pg, 10);
        pg = pg > 1 ? pg : '';
        let cateUrl = `${HOST}/${tid}/index${pg}.html`;
        let resHtml = await request(cateUrl);
        let VODS = getVodList(resHtml);
        let pagecount = 999;
        return JSON.stringify({list: VODS,page: pg,pagecount: pagecount,limit: 30,total: 30*pagecount});
    } catch (e) {
        console.error('类别页获取失败：', e.message);
        return JSON.stringify({list: [],page: 1,pagecount: 0,limit: 30,total: 0});
    }
}
async function search(wd, quick, pg) {
    try {
        pg = parseInt(pg, 10);
        pg = pg > 0 ? pg : 1;
        let searchUrl = `${HOST}//auete4so.php??searchword=${wd}&page=${pg}`;
        let resHtml = await request(searchUrl);
        let VODS = getVodList(resHtml);
        return JSON.stringify({list: VODS,page: pg,pagecount: 10,limit: 30,total: 300});
    } catch (e) {
        console.error('搜索页获取失败：', e.message);
        return JSON.stringify({list: [],page: 1,pagecount: 0,limit: 30,total: 0});
    }
}
function getVodList(khtml) {
    try {
        if (!khtml) throw new Error('源码为空');
        let kvods = [];
        let $ = load(khtml);
        let listArr = $('ul.threadlist li').get();
        for (let it of listArr) {
            let $it = $(it);
            let kname = dealStr($it.find('h2').text(), '名称');
            let kpic = dealStr($it.find('img').attr('src'), '图片');
            let kremarks = dealStr($it.find('.hdtag').text(), '状态');
            kvods.push({vod_name: kname,vod_pic: kpic,vod_remarks: kremarks,vod_id: `${dealStr($it.find('a').attr('href'), 'Id')}`});
        }
        return kvods;
    } catch (e) {
        console.error(`生成视频列表失败：`, e.message);
        return [];
    }
}
async function detail(ids) {
    try {
        let detailUrl = !/^http/.test(ids) ? `${HOST}${ids}` : ids;
        let resHtml = await request(detailUrl);
        if (!resHtml) throw new Error('源码请求失败');
        let $ = load(resHtml);
        let intros = $('.message').html() || '';
        let ktabs = $('#player_list').get().map((it, idx)=>cutStr(dealStr($(it).find('h2').text()), '』', '：', `云播-${idx+1}`));
        let kurls = $('#player_list').get().map(item=>{
            let kurl = $(item).find('a').get().map(it=>{
                let $it = $(it);
                return dealStr($it.text(), 'noEpi')+'$'+dealStr($it.attr('href'), 'noUrl');
            });
            return kurl.join('#');
        });
        let VOD = {
            vod_id: detailUrl,vod_name: cutStr(intros, '影片片名: ', '</p>', '片名'),vod_pic: dealStr($('.cover img').attr('src'), `图片`),
            type_name: cutStr(intros, '影片分类: ', '</p>', '分类'),vod_remarks: cutStr(intros, '影片备注: ', '</p>', '备注'),
            vod_year: cutStr(intros, '上映年份: ', '</p>', '1000'),vod_area: cutStr(intros, '影片地区: ', '<span', '地区'),
            vod_lang: cutStr(intros, '影片语言: ', '<span', '语言'),vod_director: cutStr(intros, '影片导演: ', '</p>', '导演'),
            vod_actor: cutStr(intros, '影片主演: ', '</p>', '主演'),vod_content: cutStr(intros, '</a><p>', '</p>', '影片简介'),
            vod_play_from: ktabs.join('$$$'),vod_play_url: kurls.join('$$$')
        };
        return JSON.stringify({list: [VOD]});
    } catch (e) {
        console.error('详情页获取失败：', e.message);
        return JSON.stringify({list: []});
    }
}
async function play(flag, ids, flags) {
    try {
        let playUrl = !/^http/.test(ids) ? `${HOST}${ids}` : ids;
        let kp = 0;
        let resHtml = await request(playUrl);
        let regex = /var\s+now\s*=\s*base64decode\(["']([^"']+)["']\)/;
        let match = resHtml.match(regex);
        let nowStr = match ? match[1] : '';
        console.log("提取结果：", nowStr);
        let kurl = base64Decode(nowStr);
        console.log("提取结果 kurl：", kurl);
        if (!/m3u8|mp4|mkv/.test(kurl)) {kp=1;kurl=playUrl;}
        return JSON.stringify({jx:0,parse:kp,url:kurl,header:DefHeader});
    } catch (e) {
        console.error('播放失败：', e.message);
        return JSON.stringify({jx:0,parse:0,url:'',header:{}});
    }
}
function dealStr(str, defaultValue='') {
    if (str==null||typeof str==='undefined'||String(str).trim()==='') return defaultValue;
    return String(str).replace(/(&nbsp;|\u00A0|\s)+/g, ' ').trim().replace(/\s+/g, ' ')||defaultValue;
}
function cutStr(str, prefix='', suffix='', defaultVal='cutFaile', clean=true, i=1, all=false) {
    try {
        if (typeof str!=='string'||!str) throw new Error('被截取对象需为非空字符串');
        const cleanStr=cs=>String(cs).replace(/<[^>]*?>/g, ' ').replace(/(&nbsp;|\u00A0|\s)+/g, ' ').trim().replace(/\s+/g, ' ');
        const esc=s=>String(s).replace(/[.*+?${}()|[\]\\/^]/g, '\\$&');
        let pre=esc(prefix).replace(/£/g, '[^]*?'),end=esc(suffix);
        let regex=new RegExp(`${pre?pre:'^'}([^]*?)${end?end:'$'}`, 'g');
        let matchIterator=str.matchAll(regex);
        if (all) {
            let matchArr=[...matchIterator];
            return matchArr.length?matchArr.map(it=>{const val=it[1]??defaultVal;return clean&&val!==defaultVal?cleanStr(val):val;}):[defaultVal];
        }
        i=parseInt(i,10);
        if (isNaN(i)||i<1) throw new Error('序号必须为正整数');
        let tgIdx=i-1,matchIdx=0;
        for (const match of matchIterator) {if(matchIdx++===tgIdx){const result=match[1]??defaultVal;return clean&&result!==defaultVal?cleanStr(result):result;}}
        return defaultVal;
    } catch (e) {
        console.error(`字符串截取失败：`, e.message);
        return all?['cutErr']:'cutErr';
    }
}
function safeParseJSON(jStr){try{return JSON.parse(jStr);}catch(e){return null;}}
function base64Encode(text){return Crypto.enc.Base64.stringify(Crypto.enc.Utf8.parse(text));}
function base64Decode(text){return Crypto.enc.Utf8.stringify(Crypto.enc.Base64.parse(text));}
async function request(reqUrl, options={}) {
    try {
        if (typeof reqUrl!=='string'||!reqUrl.trim()) throw new Error('reqUrl需为字符串且非空');
        if (typeof options!=='object'||Array.isArray(options)||!options) throw new Error('options类型需为非null对象');
        options.method=options.method?.toLowerCase()||'get';
        if(['get','head'].includes(options.method)){delete options.data;delete options.postType;}
        else{options.data=options.data??'';options.postType=options.postType?.toLowerCase()||'form';}
        let {headers,timeout,toBase64=false,...restOpts}=options;
        const optObj={
            headers:(typeof headers==='object'&&!Array.isArray(headers)&&headers)?headers:KParams.headers,
            timeout:parseInt(timeout,10)>0?parseInt(timeout,10):KParams.timeout,buffer:toBase64?2:0,...restOpts
        };
        const res=await req(reqUrl,optObj);
        if(options.withHeaders){
            const resHeaders=typeof res.headers==='object'&&!Array.isArray(res.headers)&&res.headers?res.headers:{};
            const resWithHeaders={...resHeaders,body:res?.content??''};
            return JSON.stringify(resWithHeaders);
        }
        return res?.content??'';
    } catch (e) {
        console.error(`${reqUrl}→请求失败：`, e.message);
        return options?.withHeaders?JSON.stringify({body:''}):'';
    }
}
export function __jsEvalReturn() {
    return {init,home,homeVod,category,search,detail,play,proxy:null};
}