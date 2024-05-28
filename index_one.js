const fs = require('fs');

const apiUrl = 'https://game.metalist.io/api/marketQuery/queryMarketSecondary';
const headers = {
  'Content-Type': 'application/json',
  'Client-App-Id': 'tbodfpihnlvhcaae',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

async function fetchCards (pageNumber = 1, pageSize = 20) {
  const payload = {
    chainNftId: 12,
    discreteList: [],
    continuityList: [],
    pageNumber: pageNumber,
    pageSize: pageSize,
    sortType: 0
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data ? data.data.list : [];
  } catch (error) {
    console.error(`Error fetching cards on page ${pageNumber}: `, error.message);
    return [];
  }
}

async function fetchAllCards () {
  const allCards = [];
  let pageNumber = 1;
  const pageSize = 20;
  let hasMore = true;

  while (hasMore) {
    const cards = await fetchCards(pageNumber, pageSize);
    if (cards.length > 0) {
      allCards.push(...cards);
      pageNumber++;
    } else {
      hasMore = false;
    }
  }

  return allCards;
}

async function fetchSaleDetails (saleAggregatorNumber) {
  const detailUrl = 'https://game.metalist.io/api/marketQuery/queryBuyNftDetail';

  try {
    const response = await fetch(detailUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ saleAggregatorNumber })
    });

    const data = await response.json();

    // Convert metaData array to object
    if (data.data && data.data.metaData) {
      const metaDataObject = {};
      data.data.metaData.forEach(item => {
        const key = item.traitType.toLowerCase();
        metaDataObject[key] = item.value;
      });
      data.data.metaData = metaDataObject;
    }
    return data.data || {};
  } catch (error) {
    console.error(`Error fetching sale details for ${saleAggregatorNumber}: `, error.message);
    return {};
  }
}

async function fetchCardSaleList ({ secondaryName, secondaryId }) {
  const saleListUrl = `https://game.metalist.io/api/marketQuery/queryMarketHome`;
  const allSales = [];

  const payload = {
    sortType: 4,
    pageNumber: 1,
    pageSize: 1,
    firstCategoryId: 12,
    secondCategoryId: secondaryId,
    discreteList: [],
    continuityList: [{
      filterName: "Level",
      filterId: 1,
      start: 1,
      end: 10,
      stepSize: 1,
      min: 1,
      max: 10
    }],
    coinId: 1
  };

  try {
    const response = await fetch(saleListUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const sales = data.data ? data.data.list : [];

    for (const sale of sales) {
      const saleDetails = await fetchSaleDetails(sale.saleAggregatorNumber);
      allSales.push({
        image: saleDetails.baseInfo.image,
        salePrice: saleDetails.baseInfo.salePrice + ' USDT',
        desc: saleDetails.baseInfo.desc,
        ...saleDetails.metaData
      });
    }
  } catch (error) {
    console.error(`Error fetching sale list for card ${secondaryName}: `, error.message);
  }

  return allSales;
}

fetchAllCards().then(async cards => {
  for (const card of cards) {
    const saleList = await fetchCardSaleList(card);
    let fileName = `sale_list_${card.secondaryName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    if (card.image && /_g\.\w+$/.test(card.image)) {
      fileName = fileName.replace('.json', '_gold.json');
    }
    fs.writeFile(fileName, JSON.stringify(saleList, null, 2), (err) => {
      if (err) {
        console.error(`Error writing to ${fileName}:`, err);
      } else {
        console.log(`Successfully wrote to ${fileName}`);
      }
    });
  }
}).catch(error => {
  console.error('Error fetching all cards:', error);
});