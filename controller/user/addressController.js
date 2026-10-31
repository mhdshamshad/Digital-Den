const User = require("../../model/userSchema");
const {State} = require("country-state-city");
const Address = require("../../model/addressModel");
const {validateAddress} = require("../../utils/validation");

const loadAddressPage = async (req, res , next) => {
    try {

      // Fetch the user
      const user = await User.findById(res.locals.userData);
      if (!user) {
        console.error("User not found for ID:", res.locals.userData);
        return res.redirect("/user/home");
      }
  
      const addressDoc = await Address.findOne({ userId: res.locals.userData });
      const addresses = addressDoc ? addressDoc.addresses : []; 
  
      // Fetch Indian states 
      const indianStates = State.getStatesOfCountry("IN");
  
      res.render("user/address", {
        user,
        addresses,
        states: indianStates,
      });
        
    } catch (error) {
        error.statusCode = 500; 
        next(error);
    }
}

const addAddress = async (req, res) => {
    try {

        const user = await User.findById(res.locals.userData);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const { 
            addressType,name,addressLine,city,landmark,
            state,pincode,phone,altPhone,isDefault } = req.body;
        
        const addressData = {
            addressType,
            name,
            addressLine,
            city,
            landmark,
            state,
            pincode,
            phone,
            altPhone: altPhone || '',
            isDefault:!!isDefault
        };

        const errors = validateAddress(addressData);
        if (errors) {
            return res.status(400).json({ success: false, errors });
        }

        let addressDoc = await Address.findOne({ userId: user._id });

        if (!addressDoc) {
            addressDoc = new Address({
                userId: user._id,
                addresses: [addressData]
            });
        } else {
            if (addressData.isDefault) {
                addressDoc.addresses.forEach(addr => addr.isDefault = false);
            }
            addressDoc.addresses.push(addressData);
        }

        await addressDoc.save();
        
        return res.status(200).json({
            success: true,
            message: 'Address added successfully'
        });
    } catch (error) {
        console.error('Error adding address:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
};

const editAddress = async (req, res) => {
    try {

        const addressId = req.params.id;
        const userId = res.locals.userData;

        let addressDoc = await Address.findOne({ userId });
        if (!addressDoc) {
            return res.status(404).json({ success: false, message: "Address document not found" });
        }

        const addressIndex = addressDoc.addresses.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        const { 
            addressType,name,addressLine,city,landmark,
            state,pincode,phone,altPhone,isDefault } = req.body;

        const addressData = {
            addressType,
            name,
            addressLine,
            city,
            landmark,
            state,
            pincode,
            phone,
            altPhone: altPhone || "",
            isDefault:!!isDefault
        };

        const errors = validateAddress(addressData); 
        if (errors && Object.keys(errors).length > 0) {
            return res.status(400).json({ success: false, errors });
        }
    
        if (addressData.isDefault) {
            addressDoc.addresses.forEach(addr => addr.isDefault = false);
        }

        addressDoc.addresses[addressIndex] = {
            ...addressDoc.addresses[addressIndex].toObject(),
            ...addressData
        };

        await addressDoc.save();
        return res.status(200).json({ success: true, message: "Address updated successfully" });
    } catch (error) {
        console.error("Error in editing address:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

const deleteAddress = async (req , res) =>{
    try {

        const addressId = req.params.id;
        const userId = res.locals.userData;

        let addressDoc = await Address.findOne({ userId });
        if (!addressDoc) {
            return res.status(404).json({ success: false, message: "Addresses  not found" });
        }

        const addressIndex = addressDoc.addresses.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        const isDefault = addressDoc.addresses[addressIndex].isDefault;

        //delete address
        addressDoc.addresses.pull({_id:addressId});
        // set first one as default  if  
        if(isDefault && addressDoc.addresses.length > 0) {
            addressDoc.addresses[0].isDefault = true;
        }
        await addressDoc.save();
        return res.status(200).json({ success: true, message: "Address deleted successfully" }); 
    } catch (error) {
        console.error("Error in deleting address:", error);
        return res.status(500).json({ success: false, message: "Server error: " + error.message });
    }
}

module.exports = {
    loadAddressPage,
    addAddress,
    editAddress,
    deleteAddress,


}