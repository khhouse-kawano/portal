import { chromium } from 'playwright';
import * as fs from 'fs';
import Encoding from 'encoding-japanese';
import csv from 'csv-parser';
import axios from 'axios';
import { shops } from './shops.js';
import env from 'dotenv';
env.config();


const downloadTownLife = async () => {
    interface Brands {
        id: string;
        pass: string;
        name: string;
    }

    const brands:Brands[] = [
        { id: process.env.TOWNLIFE_ID_KH as string, pass: process.env.TOWNLIFE_PASS_KH as string, name: "KH" },
        { id: process.env.TOWNLIFE_ID_DJH as string, pass: process.env.TOWNLIFE_PASS_DJH as string, name: "DJH" },
        { id: process.env.TOWNLIFE_ID_NAGOMI as string, pass: process.env.TOWNLIFE_PASS_NAGOMI as string, name: "Nagomi" },
        { id: process.env.TOWNLIFE_ID_PGH as string, pass: process.env.TOWNLIFE_PASS_PGH as string, name: "PGH" }
    ];
    

    for (const brand of brands) {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('https://www.town-life.jp/home/kanri/');
        await page.fill('#login', brand.id);
        await page.fill('#pw', brand.pass);
        await page.click('#main_container > div.login_form > div > form > fieldset > dl.submit > input[type=button]');
        await page.waitForLoadState('load');

        const downloadPromise = page.waitForEvent('download');
        await page.goto('https://www.town-life.jp/home/kanri/index.php?action_AdminInquiryList=true');
        await page.click('#main_container > div.main_content > div.center_content > form:nth-child(4) > div.btnArea > input[type=button]');
        const download = await downloadPromise;

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const fileName = `./download/${brand.name}_${year}${month}${day}_townlife.csv`;
        await download.saveAs(fileName);
        

        const sjisBuffer = fs.readFileSync(fileName);
        const unicodeArray = Encoding.convert(sjisBuffer, { to: 'UNICODE', from: 'SJIS', });
        const unicodeString = Encoding.codeToString(unicodeArray);
        fs.writeFileSync(fileName, unicodeString);

        const records: Record<string, string>[] = [];
        const columnMapping: Record<string, string | undefined> = {
            '問い合わせID': 'id_townlife',
            '顧客氏名': 'name_townlife',
            'ふりがな': 'kana_townlife',
            '年齢': 'age_townlife',
            '郵便番号': 'zip_townlife',
            '住所都道府県': 'pref_townlife',
            '住所市区町村': 'city_townlife',
            '住所詳細': 'address_townlife',
            'メールアドレス': 'mail_townlife',
            '電話番号': 'phone_townlife',
            '建設予定地': 'place_townlife',
            '建設予定地詳細': 'place_detail_townlife',
            '希望階数': 'floor_townlife',
            '予定人数（大人）': 'adult_townlife',
            '予定人数（子ども）': 'child_townlife',
            '間取り（LDK）': 'ldk_townlife',
            '建物予算': 'budget_townlife',
            '土地の大きさ': 'large_townlife',
            '土地予算': 'budget_estate_townlife',
            '土地に関するご希望': 'demand_estate_townlife',
            '敷地図・土地図面等の添付': 'image_townlife',
            '家のこだわり': 'demand_house_townlife',
            'その他': 'note_townlife',
            'お問合せ日時': 'response_date_townlife',
            '店舗': 'shop_townlife',
            '状況': 'status_townlife',
        }

        fs.createReadStream(fileName)
            .pipe(csv()).on('data', (row) => {
                const mappedRecord: Record<string, string> = {};
                for (const [key, value] of Object.entries(row) as [string, string][]) {
                    mappedRecord[columnMapping[key] as string || key] = value;
                }
                records.push(mappedRecord);
            })
            .on('end', async () => {
                for (const record of records) {
                    if( record['name_townlife'] !== '取消処理されました'){
                    record['shop_townlife'] = brand.name;
                    if(record['response_date_townlife']){
                        record['response_date_townlife'] = record['response_date_townlife'].replace( /-/g, '/').split(" ")[0];
                    }
                    if(record['address_townlife']) {
                        record['address_townlife'] = record['address_townlife'].replace(/"/g, '').replace('=', '');
                    }
                    if (record['place_detail_townlife']) {
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_townlife'] && record['place_detail_townlife'].includes(shop.area)
                        );
                    
                        if(matchedShop){
                            record['shop'] = matchedShop.shop;
                        }
                    }
                    if (!record['response_date_townlife'] || record['shop'] === undefined ){
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_townlife'] && record['city_townlife'].includes(shop.area)
                        );
                        record['shop'] = matchedShop ? matchedShop.shop : `${record['shop_townlife'].replace('Nagomi', 'なごみ')}店舗未設定`;
                    }
                    const data = new URLSearchParams(record);
                    try {
                        const response = await axios.post(
                            'https://khg-marketing.info/api/townlife.php',
                            data,
                            {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            }
                        );
                        console.log(record);
                        console.log('Data sent successfully:', response.data);
                    } catch (error) {
                        console.error('Error sending data for record:', record, error);
                    }
                }
            }
            });
            await browser.close();
    }
};

const downloadHomes = async () =>{
    interface Brands {
        id: string;
        pass: string;
        name: string;
    }

    const brands:Brands[] = [
        { id: process.env.HOMES_ID_KH as string, pass: process.env.HOMES_PASS_KH as string, name: "KH" },
        { id: process.env.HOMES_ID_DJH as string, pass: process.env.HOMES_PASS_DJH as string, name:"DJH" }
    ];

    for (const brand of brands) {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('https://iezukuri-manager.homes.co.jp/login');
        await page.fill('//html/body/div[2]/div/div/div/form/div/dl/dd[1]/input', brand.id);
        await page.fill('//html/body/div[2]/div/div/div/form/div/dl/dd[2]/input', brand.pass);
        await page.click('//html/body/div[2]/div/div/div/form/div/div/div/button');
        await page.waitForLoadState('load');

        const downloadPromise = page.waitForEvent('download');
        await page.goto('https://iezukuri-manager.homes.co.jp/inquire/mail');
        await page.click('//html/body/div[2]/div[2]/div[2]/div[2]/div/form/div/p/button');
        const download = await downloadPromise;

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const fileName = `./download/${brand.name}_${year}${month}${day}homes.csv`;
        await download.saveAs(fileName);
        

        const sjisBuffer = fs.readFileSync(fileName);
        const unicodeArray = Encoding.convert(sjisBuffer, { to: 'UNICODE', from: 'SJIS', });
        const unicodeString = Encoding.codeToString(unicodeArray);
        fs.writeFileSync(fileName, unicodeString);

        const records: Record<string, string>[] = [];
        const columnMapping: Record<string, string | undefined> = {
            '問合せ番号': 'id_homes',
            '問合せ日時': 'date_homes',
            '氏名': 'name_homes',
            'シメイ': 'kana_homes',
            '郵便番号': 'zip_homes',
            '住所': 'address_homes',
            'メールアドレス': 'mail_homes',
            '電話番号': 'phone_homes',
            '建設予定時期': 'period_homes',
            '土地所有の有無': 'estate_homes',
            '現在の検討状況': 'status_homes',
            '建築予算': 'budget_detail_homes',
            '世帯年収': 'income_homes',
            '年齢': 'age_homes',
            '建築予定地（市区町村）': 'place_homes'
        }

        fs.createReadStream(fileName)
            .pipe(csv()).on('data', (row) => {
                const mappedRecord: Record<string, string> = {};
                for (const [key, value] of Object.entries(row) as [string, string][]) {
                    mappedRecord[columnMapping[key] as string || key] = value;
                }
                records.push(mappedRecord);
            })
            .on('end', async () => {
                for (const record of records) {
                    record['shop_homes'] = brand.name;
                    if(record['date_homes']){
                        record['date_homes'] = record['date_homes'].replace( /年|月/g, '/').replace("日", "").split(" ")[0];
                    }
                    if (record['place_homes']) {
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_homes'] && record['place_homes'].includes(shop.area)
                        );
                    
                        if(matchedShop){
                            record['shop'] = matchedShop.shop;
                        }
                    }
                    if (!record['place_homes'] || record['shop'] === undefined ){
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_homes'] && record['address_homes'].includes(shop.area)
                        );
                        record['shop'] = matchedShop ? matchedShop.shop : `${record['shop_homes'].replace('Nagomi', 'なごみ')}店舗未設定`;
                    }
                    const data = new URLSearchParams(record);
                    try {
                        const response = await axios.post(
                            'https://khg-marketing.info/api/homes.php',
                            data,
                            {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            }
                        );
                        console.log(record);
                        console.log('Data sent successfully:', response.data);
                    } catch (error) {
                        console.error('Error sending data for record:', record, error);
                    }
                }
            });
            await browser.close();
    }
};


const downloadSuumo = async () =>{
    interface Brands {
        id: string;
        pass: string;
        name: string;
    }

    const brands:Brands[] = [
        { id: process.env.SUUMO_ID_KH as string, pass: process.env.SUUMO_PASS_KH as string, name: "KH" },
        { id: process.env.SUUMO_ID_DJH as string, pass: process.env.SUUMO_PASS_DJH as string, name: "DJH" },
        { id: process.env.SUUMO_ID_NAGOMI as string, pass: process.env.SUUMO_PASS_NAGOMI as string, name:"Nagomi" }
    ];

    for (const brand of brands) {
        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('https://www.housingnavi.jp/house/hj/operation/download/E_600.do');
        await page.fill('//html/body/div/table/tbody/tr/td/div/form/table[2]/tbody/tr[2]/td/table/tbody/tr[1]/td[2]/input', brand.id);
        await page.fill('//html/body/div/table/tbody/tr/td/div/form/table[2]/tbody/tr[2]/td/table/tbody/tr[2]/td[2]/input', brand.pass);
        await page.click('//html/body/div/table/tbody/tr/td/div/form/table[2]/tbody/tr[2]/td/table/tbody/tr[6]/td/input');
        await page.waitForLoadState('load');

        const today = new Date();
        const year = today.getFullYear();
        const targetMonth = String(today.getMonth()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        await page.click('//html/body/div[1]/table/tbody/tr/td/div[2]/table[2]/tbody/tr[2]/td/a');
        await page.selectOption('//html/body/div[2]/table/tbody/tr/td/form[2]/table[2]/tbody/tr[2]/td[1]/select[2]', targetMonth);
        await page.selectOption('//html/body/div[2]/table/tbody/tr/td/form[2]/table[3]/tbody/tr/td/select', "2");

        const downloadPromise = page.waitForEvent('download');
        await page.click('//html/body/div[2]/table/tbody/tr/td/form[2]/table[3]/tbody/tr/td/input');
        const download = await downloadPromise;

        const fileName = `./download/${brand.name}_${year}${month}${day}suumo.txt`;
        await download.saveAs(fileName);
        

        const sjisBuffer = fs.readFileSync(fileName);
        const unicodeArray = Encoding.convert(sjisBuffer, { to: 'UNICODE', from: 'SJIS', });
        const unicodeString = Encoding.codeToString(unicodeArray);
        fs.writeFileSync(fileName, unicodeString);

        const outputFile = `./download/${brand.name}_${year}${month}${day}suumo.csv`;

        const convertToCsv = async () => {
            try {
                const data = await fs.promises.readFile(fileName, 'utf-8');
                const csvData = data.split('\n').map(line => line.replace(/\t/g, ',')).join('\n');
                await fs.promises.writeFile(outputFile, csvData, { encoding: 'utf8' });
                console.log("変換完了");
            } catch (err) {
                throw err;
            }
        };
          
        await convertToCsv();

        const records: Record<string, string>[] = [];
        const columnMapping: Record<string, string | undefined> = {
            '資料請求日': 'date_suumo',
            '依頼番号': 'id_suumo',
            '名前（漢字）氏': 'sei_suumo',
            '名前（漢字）名': 'mei_suumo',
            '名前（フリガナ等）氏': 'sei_kana_suumo',
            '名前（フリガナ等）名': 'mei_kana_suumo',
            '年齢': 'age_suumo',
            '郵便番号': 'zip_suumo',
            '住所1': 'address1_suumo',
            '住所2': 'address2_suumo',
            '住所3': 'address3_suumo',
            'E-mailアドレス': 'mail_suumo',
            '電話番号': 'phone_suumo',
            '建築予定時期': 'period_suumo',
            '建設予定地（名称）': 'place_suumo',
            '予算（土地予算除く）': 'budget_suumo',
        }

        fs.createReadStream(outputFile)
            .pipe(csv()).on('data', (row) => {
                const mappedRecord: Record<string, string> = {};
                for (const [key, value] of Object.entries(row) as [string, string][]) {
                    mappedRecord[columnMapping[key] as string || key] = value;
                }
                records.push(mappedRecord);
            })
            .on('end', async () => {
                for (const record of records) {
                    if(record['date_suumo']){
                        record['date_suumo'] = record['date_suumo'].replace(/\./g, '/');
                    }
                    record['shop_suumo'] = brand.name;
                    if (record['place_suumo']) {
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_suumo'] && record['place_suumo'].includes(shop.area)
                        );
                        if(matchedShop){
                            record['shop'] = matchedShop.shop;
                        }
                    }
                    if (!record['place_suumo'] || record['shop'] === undefined ){
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_suumo'] && record['address3_suumo'].includes(shop.area)
                        );
                        record['shop'] = matchedShop ? matchedShop.shop : `${record['shop_suumo'].replace('Nagomi', 'なごみ')}店舗未設定`;
                    }
                    const data = new URLSearchParams(record);
                    try {
                        const response = await axios.post(
                            'https://khg-marketing.info/api/suumo.php',
                            data,
                            {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            }
                        );
                        console.log(record);
                        console.log('Data sent successfully:', response.data);
                    } catch (error) {
                        console.error('Error sending data for record:', record, error);
                    }
                }
            });
            await browser.close();
    }
};



const downloadAllGrit = async () =>{

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('https://line-saas.auka.jp/builder/login');
        await page.fill('//html/body/div[2]/div/div/div/main/div/div[1]/div/div/div/div/div[3]/form/div[1]/div/div[1]/div/input', process.env.ALLGRIT_ID as string);
        await page.fill('//html/body/div[2]/div/div/div/main/div/div[1]/div/div/div/div/div[3]/form/div[2]/div/div[1]/div/input', process.env.ALLGRIT_PASS as string);
        await page.click('//html/body/div[2]/div/div/div/main/div/div[1]/div/div/div/div/div[3]/form/div[3]/button/span');
        await page.waitForLoadState('load');

        interface Brands {
            pass: string;
            name: string;
        };
    
        const brands:Brands[] = [
            { pass: "//html/body/div[2]/div/div/div/main/div/div/div/div/div[3]/div[1]/div[3]/button", name: "KH" },
            { pass: "//html/body/div[2]/div/div/div/main/div/div/div/div/div[3]/div[2]/div[3]/button", name: "KHG" },
            { pass: "//html/body/div[2]/div/div/div/main/div/div/div/div/div[3]/div[3]/div[3]/button", name:"DJH" }
        ];

        for (const brand of brands) {
        await page.click(brand.pass);
        await page.click('//html/body/div[2]/div/div/div/div[1]/nav/div[1]/div/div/div[1]/div');
        await page.click('//html/body/div[2]/div/div/div/div[1]/div/div/a[2]');
        await page.waitForLoadState('load');

        const downloadPromise = page.waitForEvent('download');
        await page.waitForLoadState('load');
        await page.click('//html/body/div[2]/div/div/div/main/div/div/div[1]/div/div[3]/div[4]/button[4]');
        const download = await downloadPromise;

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        const fileName = `./download/${brand.name}_${year}${month}${day}ALLGRIT.csv`;
        await download.saveAs(fileName);

        const waitForFile = async (filePath: string)=>{
            while(true){
                try{
                    await fs.promises.access(filePath);
                    return;
                } catch (error){
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        };

        await waitForFile(fileName);

        const records: Record<string, string>[] = [];
        const columnMapping: Record<string, string | undefined> = {
            'お客様LINEUID': 'id_allGrit',
            'LINE登録日': 'date_allGrit',
            'リードステータス': 'status_allGrit',
            '姓': 'sei_allGrit',
            '名': 'mei_allGrit',
            '連絡先メールアドレス': 'mail_allGrit',
            '電話番号': 'phone_allGrit',
            '郵便番号': 'zip_allGrit',
            '住所': 'address1_allGrit',
            '予算': 'budget_allGrit',
            '希望エリアの都道府県': 'pref_allGrit',
            '希望エリアの市区町村第1希望': 'city_allGrit',
            '建築予定地（市区町村）': 'place_homes'
        };

        fs.createReadStream(fileName)
            .pipe(csv()).on('data', (row) => {
                const mappedRecord: Record<string, string> = {};
                for (const [key, value] of Object.entries(row) as [string, string][]) {
                    mappedRecord[columnMapping[key] as string || key] = value;
                }
                records.push(mappedRecord);
            })
            .on('end', async () => {
                for (const record of records) {
                    if ( record.status_allGrit !== "来店前" && record.sei_allGrit !=="") {
                        if(record['date_allGrit']){
                            record['date_allGrit'] = record['date_allGrit'].replace( /-/g, '/').split(" ")[0];
                        }
                    record['shop_allGrit'] = brand.name;
                    if (record['city_allGrit']) {
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_allGrit'] && record['city_allGrit'].includes(shop.area)
                        );
                        if(matchedShop){
                            record['shop'] = matchedShop.shop;
                        }
                    }
                    if (!record['city_allGrit'] || record['shop'] === undefined ){
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_allGrit'] && record['address1_allGrit'].includes(shop.area)
                        );
                        record['shop'] = matchedShop ? matchedShop.shop : `${record['shop_allGrit'].replace('Nagomi', 'なごみ')}店舗未設定`;
                    }
                    const data = new URLSearchParams(record);
                    try {
                        const response = await axios.post(
                            'https://khg-marketing.info/api/allGrit.php',
                            data,
                            {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            }
                        );
                        console.log(record);
                        console.log('Data sent successfully:', response.data);
                    } catch (error) {
                        console.error('Error sending data for record:', record, error);
                    }
                }}
            });
            await page.click('//html/body/div[2]/div/div/div/header/div/button[1]');
        }
        await browser.close();
};

const downloadMochiie = async() =>{
    interface Brands {
        id: string;
        pass: string;
        name:string;
    }

    const brands:Brands[] =[
        { id: process.env.MOCHIIE_ID_DJH as string, pass: process.env.MOCHIIE_PASS_DJH as string, name: "DJH"},
        { id: process.env.MOCHIIE_ID_NAGOMI as string, pass: process.env.MOCHIIE_PASS_NAGOMI as string, name: "Nagomi"}
    ];

    for (const brand of brands){
        const browser = await chromium.launch({headless: true});
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto('https://admin.mochiie.com/login');
        await page.fill('//html/body/div[2]/div/div/div/div[2]/form/fieldset/div[1]/input', brand.id);
        await page.fill('//html/body/div[2]/div/div/div/div[2]/form/fieldset/div[2]/input', brand.pass);
        await page.click('//html/body/div[2]/div/div/div/div[2]/form/fieldset/button');
        await page.waitForLoadState('load');

        await page.click('//html/body/div/div/div/aside/div[1]/div[2]/a');
        const downloadPromise = page.waitForEvent('download');
        await page.click('//html/body/div/div/div/main/div/div/div/div/div/article/p/a[1]');
        const download = await downloadPromise;

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const fileName = `./download/${brand.name}_${year}${month}${day}_mochiie.csv`;
        await download.saveAs(fileName);

        const sjisBuffer = fs.readFileSync(fileName);
        const unicodeArray = Encoding.convert(sjisBuffer, { to: 'UNICODE', from: 'SJIS', });
        const unicodeString = Encoding.codeToString(unicodeArray);
        fs.writeFileSync(fileName, unicodeString);

        const records:Record<string, string>[] = [];
        const columnMapping:Record<string, string | undefined> = {
            'ユーザID': 'id_mochiie',
            '姓': 'sei_mochiie',
            '名': 'mei_mochiie',
            'せい': 'sei_kana_mochiie',
            'めい': 'mei_kana_mochiie',
            '性別': 'gender_mochiie',
            '生年月日': 'birth_mochiie',
            '年齢': 'age_mochiie',
            'ご連絡先住所': 'address_mochiie',
            '電話番号': 'phone_mochiie',
            'E-mail': 'mail_mochiie',
            '職業': 'job_mochiie',
            '土地有無': 'estate_mochiie',
            '土地購入エリア（都道府県）': 'area_pref_mochiie',
            '土地購入エリア（市区郡）': 'area_city_mochiie',
            'ご希望世帯について': 'family_mochiie',
            '何階建てを希望しますか？': 'structure_mochiie',
            '住宅に住む予定人数？': 'member_mochiie',
            'ご希望の間取りについて': 'plan_mochiie',
            '土地の大きさ': 'large_mochiie',
            '希望の建築予算': 'budget_mochiie',
            'ご意見・ご質問': 'demand_mochiie',
            '利用日時': 'date_mochiie',
            'こだわり検索': 'search_mochiie',
            '来場場所': 'reserve_mochiie',
            'メモ': 'note_mochiie'
        }

        fs.createReadStream(fileName)
            .pipe(csv()).on('data', (row)=>{
                const mappedRecord: Record<string, string> = {};
                for ( const [key, value] of Object.entries(row) as [string, string][] ) {
                    mappedRecord[columnMapping[key] as string || key ] = value;
                }
                records.push(mappedRecord);
            })
            .on('end', async() =>{
                for ( const record of records ){
                    record['shop_mochiie'] = brand.name;
                    if(record['shop_mochiie']){
                        record['date_mochiie'] = record['date_mochiie'].split(' ')[0];
                    }
                    if (record['area_city_mochiie']) {
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_mochiie'] && record['area_city_mochiie'].includes(shop.area)
                        );
                        if(matchedShop){
                            record['shop'] = matchedShop.shop;
                        }
                    }
                    if (!record['area_city_mochiie'] || record['shop'] === undefined ){
                        const matchedShop = shops.find(
                            shop => shop.brand === record['shop_mochiie'] && record['address_mochiie'].includes(shop.area)
                        );
                        record['shop'] = matchedShop ? matchedShop.shop : `${record['shop_mochiie'].replace('Nagomi', 'なごみ')}店舗未設定`;
                    }
                    const data = new URLSearchParams(record);
                    try{
                        const response = await axios.post(
                            'http://khg-marketing.info/api/mochiie.php',
                            data,
                            {
                                headers: {
                                    'Content-Type': 'application/x-www-form-urlencoded'
                                }
                            });
                        console.log(record);
                        console.log('Data sent successfully:', response.data);
                    } catch (error){
                        console.error('Error sending data for record:', record, error);

                    }
                }
            });
            await browser.close();
    }
};


downloadHomes();
downloadSuumo();
downloadTownLife();
downloadAllGrit();
downloadMochiie();
