const mongoose = require('mongoose');
const Schemea = mongoose.Schema;

const CustomerModel = new Schemea({
    userName:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true
    },
    acessToken:{
        type:String,
        required:true
    },
    accountId:{
        type:String,
        required:true
    }
});
mongoose.model('CustomerModel',CustomerModel);