'use strict';

var util = require('util');

var envvar = require('envvar');
var express = require('express');
var bodyParser = require('body-parser');
var moment = require('moment');
var plaid = require('plaid');
const mongoose = require('mongoose')


envvar.PLAID_CLIENT_ID = "5e331d5c2122ac0012a9890a"
envvar.APP_PORT = 5000
envvar.PLAID_SECRET = "98a3ea0dbcc76fe4919d29044eea02"
envvar.PLAID_PUBLIC_KEY = "948b0f0032f2f5de71ff8632cd5848"
envvar.PLAID_PRODUCTS = "transactions"
envvar.PLAID_COUNTRY_CODES ="US,CA,GB,FR,ES,IE"
envvar.PLAID_ENV = "development"


var APP_PORT = 5000//envvar.number('APP_PORT', 8000);
var PLAID_CLIENT_ID = "5e331d5c2122ac0012a9890a"//envvar.string('PLAID_CLIENT_ID');
var PLAID_SECRET = "98a3ea0dbcc76fe4919d29044eea02"//envvar.string('PLAID_SECRET');
var PLAID_PUBLIC_KEY = "948b0f0032f2f5de71ff8632cd5848"//envvar.string('PLAID_PUBLIC_KEY');
var PLAID_ENV = "development"//envvar.string('PLAID_ENV', 'sandbox');

// PLAID_PRODUCTS is a comma-separated list of products to use when initializing
// Link. Note that this list must contain 'assets' in order for the app to be
// able to create and retrieve asset reports.
var PLAID_PRODUCTS = envvar.string('PLAID_PRODUCTS', 'transactions');

// PLAID_PRODUCTS is a comma-separated list of countries for which users
// will be able to select institutions from.
var PLAID_COUNTRY_CODES = envvar.string('PLAID_COUNTRY_CODES', 'US,CA');


// We store the access_token in memory - in production, store it in a secure
// persistent data store
var ACCESS_TOKEN = null;
var PUBLIC_TOKEN = null;
var ITEM_ID = null;
// We store the payment_token in memory - in production, store it in a secure
// persistent data store
var PAYMENT_TOKEN = null;
var PAYMENT_ID = null;

// Initialize the Plaid client
// Find your API keys in the Dashboard (https://dashboard.plaid.com/account/keys)
var client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments[PLAID_ENV],
  {version: '2019-05-29', clientApp: 'Plaid Quickstart'}
);


var app = express();
mongoose.connect('mongodb://localhost/qpay',{
}).then(function(){
  console.log("db connected")
}).catch(function(reason){
console.log(reason.toString())
});

require('./CustomerModel');
const CustomerObj = mongoose.model('CustomerModel');


app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

app.get('/', function(request, response, next) {
  response.render('index.ejs', {
    PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
    PLAID_ENV: PLAID_ENV,
    PLAID_PRODUCTS: PLAID_PRODUCTS,
    PLAID_COUNTRY_CODES: PLAID_COUNTRY_CODES,
  });
});

// Exchange token flow - exchange a Link public_token for
// an API access_token
// https://plaid.com/docs/#exchange-token-flow
app.post('/get_access_token', function(request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;
  let ACCOUNT_ID = request.body.account_id;
  client.exchangePublicToken(PUBLIC_TOKEN, function(error, tokenResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      console.log("got an error")
      console.log(PUBLIC_TOKEN)
      return response.json({
        error: error,
      });
    }

    ACCESS_TOKEN = tokenResponse.access_token;
    ITEM_ID = tokenResponse.item_id;
    prettyPrintResponse(tokenResponse);

    const newCustomer = {
      userName:"BSEBAT1",
      email:"berkaydev@gmail.com",
      acessToken:ACCESS_TOKEN,
      accountId:ACCOUNT_ID,
    }

    new CustomerObj(newCustomer).save().then(customer => {
      console.log('saved the customer'+customer)
    });

    client.createStripeToken(ACCESS_TOKEN, ACCOUNT_ID, function(err, res) {
      prettyPrintResponse(res)
      if (err != null) {
        prettyPrintResponse(err)
      } else {
        var bankAccountToken = res.stripe_bank_account_token;
        console.log("the bank account is")
        console.log(bankAccountToken)

        var stripe = require('stripe')('sk_live_eXivzTNAq3kEwh0ZsPduLg6E00wwE2ZLxL');
        stripe.charges.create(
        {
        amount: 100,
        currency: 'usd',
        source: bankAccountToken,
        description: 'My First Test Charge (created for API docs)',
        },
  function(err, charge) {
    if (err != null){
      console.log("we had an error")
      console.log(err.toString)
    } else {
      console.log("charge success")
    }
  }
);
      }
    });

    response.json({
      access_token: ACCESS_TOKEN,
      item_id: ITEM_ID,
      error: null,
    });
  });
});


// Retrieve Transactions for an Item
// https://plaid.com/docs/#transactions
app.get('/transactions', function(request, response, next) {
  // Pull transactions for the Item for the last 30 days
  var startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
  var endDate = moment().format('YYYY-MM-DD');
  client.getTransactions(ACCESS_TOKEN, startDate, endDate, {
    count: 250,
    offset: 0,
  }, function(error, transactionsResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error
      });
    } else {
      prettyPrintResponse(transactionsResponse);
      response.json({error: null, transactions: transactionsResponse});
    }
  });
});

//Try and get a saved transaction
app.post('/savedTransaction',function(request,response){
CustomerObj.find({}).then(customers =>{
  let token = customers[0].acessToken
  let accountid = customers[0].accountId

  console.log("the customer is "+ customers)
  console.log("the acessToken is"+token, "the accountid is"+accountid)

  client.createStripeToken(token, accountid, function(err, res) {
    prettyPrintResponse(res)
    if (err != null) {
      prettyPrintResponse(err)
    } else {
      var bankAccountToken = res.stripe_bank_account_token;
      console.log("the bank account is")
      console.log(bankAccountToken)

      var stripe = require('stripe')('sk_live_eXivzTNAq3kEwh0ZsPduLg6E00wwE2ZLxL');
      stripe.charges.create(
      {
      amount: 100,
      currency: 'usd',
      source: bankAccountToken,
      description: 'My First Test Charge (created for API docs)',
      },
function(err, charge) {
  if (err != null){
    console.log("we had an error")
    console.log(err.toString)
  } else {
    console.log("charge success")
  }
}
);
    }
  });
});
response.sendStatus(200)
});
// Retrieve Identity for an Item
// https://plaid.com/docs/#identity
app.get('/identity', function(request, response, next) {
  client.getIdentity(ACCESS_TOKEN, function(error, identityResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(identityResponse);
    response.json({error: null, identity: identityResponse});
  });
});

// Retrieve real-time Balances for each of an Item's accounts
// https://plaid.com/docs/#balance
app.get('/balance', function(request, response, next) {
  client.getBalance(ACCESS_TOKEN, function(error, balanceResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(balanceResponse);
    response.json({error: null, balance: balanceResponse});
  });
});

// Retrieve an Item's accounts
// https://plaid.com/docs/#accounts
app.get('/accounts', function(request, response, next) {
  client.getAccounts(ACCESS_TOKEN, function(error, accountsResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(accountsResponse);
    response.json({error: null, accounts: accountsResponse});
  });
});

// Retrieve ACH or ETF Auth data for an Item's accounts
// https://plaid.com/docs/#auth
app.get('/auth', function(request, response, next) {
  client.getAuth(ACCESS_TOKEN, function(error, authResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(authResponse);
    response.json({error: null, auth: authResponse});
  });
});

// Retrieve Holdings for an Item
// https://plaid.com/docs/#investments
app.get('/holdings', function(request, response, next) {
  client.getHoldings(ACCESS_TOKEN, function(error, holdingsResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(holdingsResponse);
    response.json({error: null, holdings: holdingsResponse});
  });
});

// Retrieve Investment Transactions for an Item
// https://plaid.com/docs/#investments
app.get('/investment_transactions', function(request, response, next) {
  var startDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
  var endDate = moment().format('YYYY-MM-DD');
  client.getInvestmentTransactions(ACCESS_TOKEN, startDate, endDate, function(error, investmentTransactionsResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(investmentTransactionsResponse);
    response.json({error: null, investment_transactions: investmentTransactionsResponse});
  });
});

// Create and then retrieve an Asset Report for one or more Items. Note that an
// Asset Report can contain up to 100 items, but for simplicity we're only
// including one Item here.
// https://plaid.com/docs/#assets
app.get('/assets', function(request, response, next) {
  // You can specify up to two years of transaction history for an Asset
  // Report.
  var daysRequested = 10;

  // The `options` object allows you to specify a webhook for Asset Report
  // generation, as well as information that you want included in the Asset
  // Report. All fields are optional.
  var options = {
    client_report_id: 'Custom Report ID #123',
    // webhook: 'https://your-domain.tld/plaid-webhook',
    user: {
      client_user_id: 'Custom User ID #456',
      first_name: 'Alice',
      middle_name: 'Bobcat',
      last_name: 'Cranberry',
      ssn: '123-45-6789',
      phone_number: '555-123-4567',
      email: 'alice@example.com',
    },
  };
  client.createAssetReport(
    [ACCESS_TOKEN],
    daysRequested,
    options,
    function(error, assetReportCreateResponse) {
      if (error != null) {
        prettyPrintResponse(error);
        return response.json({
          error: error,
        });
      }
      prettyPrintResponse(assetReportCreateResponse);

      var assetReportToken = assetReportCreateResponse.asset_report_token;
      respondWithAssetReport(20, assetReportToken, client, response);
    });
});

// Retrieve Payment for a specified Payment ID
// https://plaid.com/docs/#payment-initiation
app.get('/payment_get', function(request, response, next) {
  client.getPayment(PAYMENT_ID, function(error, paymentGetResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(paymentGetResponse);
    response.json({error: null, payment: paymentGetResponse});
  });
});

// Retrieve information about an Item
// https://plaid.com/docs/#retrieve-item
app.get('/item', function(request, response, next) {
  // Pull the Item - this includes information about available products,
  // billed products, webhook information, and more.
  client.getItem(ACCESS_TOKEN, function(error, itemResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error
      });
    }
    // Also pull information about the institution
    client.getInstitutionById(itemResponse.item.institution_id, function(err, instRes) {
      if (err != null) {
        var msg = 'Unable to pull institution information from the Plaid API.';
        console.log(msg + '\n' + JSON.stringify(error));
        return response.json({
          error: msg
        });
      } else {
        prettyPrintResponse(itemResponse);
        response.json({
          item: itemResponse.item,
          institution: instRes.institution,
        });
      }
    });
  });
});

var server = app.listen(APP_PORT, function() {
  console.log('plaid-quickstart server listening on port ' + APP_PORT);
});

var prettyPrintResponse = response => {
  console.log(util.inspect(response, {colors: true, depth: 4}));
};

// This is a helper function to poll for the completion of an Asset Report and
// then send it in the response to the client. Alternatively, you can provide a
// webhook in the `options` object in your `/asset_report/create` request to be
// notified when the Asset Report is finished being generated.
var respondWithAssetReport = (
  numRetriesRemaining,
  assetReportToken,
  client,
  response
) => {
  if (numRetriesRemaining == 0) {
    return response.json({
      error: 'Timed out when polling for Asset Report',
    });
  }

  var includeInsights = false;
  client.getAssetReport(
    assetReportToken,
    includeInsights,
    function(error, assetReportGetResponse) {
      if (error != null) {
        prettyPrintResponse(error);
        if (error.error_code == 'PRODUCT_NOT_READY') {
          setTimeout(
            () => respondWithAssetReport(
              --numRetriesRemaining, assetReportToken, client, response),
            1000
          );
          return
        }

        return response.json({
          error: error,
        });
      }

      client.getAssetReportPdf(
        assetReportToken,
        function(error, assetReportGetPdfResponse) {
          if (error != null) {
            return response.json({
              error: error,
            });
          }

          response.json({
            error: null,
            json: assetReportGetResponse.report,
            pdf: assetReportGetPdfResponse.buffer.toString('base64'),
          })
        }
      );
    }
  );
};

app.post('/set_access_token', function(request, response, next) {
  ACCESS_TOKEN = request.body.access_token;
  client.getItem(ACCESS_TOKEN, function(error, itemResponse) {
    response.json({
      item_id: itemResponse.item.item_id,
      error: false,
    });
  });
});

// Sets the payment token in memory on the server side. We generate a new
// payment token so that the developer is not required to supply one.
// This makes the quickstart easier to use.
app.post('/set_payment_token', function(request, response, next) {
  client.createPaymentRecipient(
    'Harry Potter',
    'GB33BUKB20201555555555',
    {street: ['4 Privet Drive'], city: 'Little Whinging', postal_code: '11111', country: 'GB'},
  ).then(function(createPaymentRecipientResponse) {
    let recipientId = createPaymentRecipientResponse.recipient_id;

    return client.createPayment(
      recipientId,
      'payment_ref',
      {currency: 'GBP', value: 12.34},
    ).then(function(createPaymentResponse) {
      let paymentId = createPaymentResponse.payment_id;

      return client.createPaymentToken(
        paymentId,
      ).then(function(createPaymentTokenResponse) {
        let paymentToken = createPaymentTokenResponse.payment_token;
        PAYMENT_TOKEN = paymentToken;
        PAYMENT_ID = paymentId;
        return response.json({error: null, paymentToken: paymentToken});
      })
    })
  }).catch(function(error) {
    prettyPrintResponse(error);
    return response.json({ error: error });
  });

});
