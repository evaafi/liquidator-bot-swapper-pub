// TODO: add tests

import {describe, it} from "node:test";
import {EXTENDED_ASSET_LIST} from "../config";
import {ASSETS_COLLECTION_MAINNET} from "../assets";
import {expect} from 'chai';

function assetByName(assetName: string): bigint {
    const _name = assetName.toLowerCase();
    if (_name === 'ton') {
        return 11876925370864614464799087627157805050745321306404563164673853337929163193738n;
    } else if (_name === 'jusdt') {
        return 81203563022592193867903899252711112850180680126331353892172221352147647262515n;
    } else if (_name === 'jusdc') {
        return 59636546167967198470134647008558085436004969028957957410318094280110082891718n;
    } else if (_name === 'stton') {
        return 33171510858320790266247832496974106978700190498800858393089426423762035476944n;
    } else if (_name === 'tston') {
        return 23103091784861387372100043848078515239542568751939923972799733728526040769767n;
    } else if (_name === 'usdt') {
        return 91621667903763073563570557639433445791506232618002614896981036659302854767224n;
    } else if (_name === 'tonusdt_dedust') {
        return 101385043286520300676049067359330438448373069137841871026562097979079540439904n;
    } else if (_name === 'tonusdt_stonfi') {
        return 45271267922377506789669073275694049849109676194656489600278771174506032218722n;
    } else if (_name === 'ton_storm') {
        return 70772196878564564641575179045584595299167675028240038598329982312182743941170n;
    } else if (_name === 'usdt_storm') {
        return 48839312865341050576546877995196761556581975995859696798601599030872576409489n;
    }

    throw new Error(`Unsupported asset '${assetName}'`);
}

describe('Test assets module', () => {
    it('all assets exist', () => {
        EXTENDED_ASSET_LIST.forEach(assetName => {
            const asset = ASSETS_COLLECTION_MAINNET.byAssetName(assetName);
            expect(assetByName(assetName)).to.eq(asset.id);
        })
    });
})
