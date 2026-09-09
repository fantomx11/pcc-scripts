import { escapeXml } from '../types';
import type { EstimateModel } from '../models/EstimateModel';

export class XactDocBuilder {
  static buildXml(estimateModel: EstimateModel): string {
    estimateModel.recalculateAll();

    const distinctCategories = estimateModel.getDistinctCategories();
    const catIdMap = new Map<string, string>();
    let catIdSeq = 800;

    let categoriesXml = '';
    distinctCategories.forEach((code) => {
      const id = String(catIdSeq++);
      catIdMap.set(code, id);
      categoriesXml += `<CATEGORY catId="${id}" code="${code}" desc="${code}" labDist="50" matDist="50" noPrefix="1" cv="0" />`;
    });

    let sumItemsXml = '';
    let groupHierarchyXml = '';
    let sumIdSeq = 100;
    let itemIdSeq = 2000;
    let grpIdSeq = 400;

    const groups = estimateModel.getItemsByGroup();

    groups.forEach((grpData) => {
      const grpId = `GRP${grpIdSeq++}`;
      let itemsXml = '';

      grpData.items.forEach((item) => {
        const sumId = `SUM${sumIdSeq++}`;
        const itemId = `ITM${itemIdSeq++}`;
        const catId = catIdMap.get(item.category) || '828';

        sumItemsXml += item.toSumItemXml(sumId, catId);
        itemsXml += item.toItemXml(itemId, sumId);
      });

      groupHierarchyXml += `
        <GROUP id="${grpId}" code="${escapeXml(grpData.code)}" type="Room" desc="${escapeXml(grpData.description)}" isRoom="1" covID="-1">
          <ITEMS>${itemsXml}</ITEMS>
        </GROUP>`;
    });

    const grandTotal = estimateModel.getTotalRcv().toFixed(2);
    const taxRateStr = (estimateModel.salesTaxRate || 0).toFixed(3);
    const projectIdEsc = escapeXml(estimateModel.projectId);
    const customerEsc = escapeXml(estimateModel.customerName);

    return `<?xml version='1.0' encoding='UTF-8' ?>
<XACTDOC lastCalcGrandTotal="${grandTotal}" totalLineItems="${estimateModel.items.length}">
  <PROJECT_INFO name="${projectIdEsc}" created="${new Date().toISOString()}"/>
  <EMBEDDED_PL culture="EN-US">
    <SUMITEMS>${sumItemsXml}</SUMITEMS>
    <CATEGORIES>${categoriesXml}</CATEGORIES>
  </EMBEDDED_PL>
  <GROUP id="GRP1">
    <GROUP id="GRP350" code="SOURCE__TEM" type="Non_Room" desc="Root" isRoom="0" covID="-1">
      <GROUP id="GRP351" code="MAIN_LEVEL" type="Non_Room" desc="Main Level" isRoom="0" covID="-1">
        ${groupHierarchyXml}
      </GROUP>
    </GROUP>
  </GROUP>
  <PARAMS taxJurisdiction="${taxRateStr}%">
    <SALESTAXES>
      <SALES_TAX type="Material Sales Tax" base="MATERIAL" rate="${taxRateStr}"/>
    </SALESTAXES>
  </PARAMS>
  <CONTACTS>
    <CONTACT type="Client" id="CNT1">
      <NAME>${customerEsc}</NAME>
    </CONTACT>
  </CONTACTS>
  <ADM dateEntered="${new Date().toISOString()}">
    <COVERAGE_LOSS solTotalClaim="${grandTotal}" solTotalLoss="${grandTotal}">
      <COVERAGES>
        <COVERAGE id="COV1">
          <LOSS_DATA rcl="${grandTotal}" acvLoss="${grandTotal}" acvClaim="${grandTotal}" rcvClaim="${grandTotal}" adjLossAmt="${grandTotal}"/>
        </COVERAGE>
      </COVERAGES>
    </COVERAGE_LOSS>
  </ADM>
</XACTDOC>`;
  }
}