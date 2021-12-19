const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { ServiceBusClient } = require("@azure/service-bus");
const connectionString = process.env.CONNECTION_STRING;
const queueName = process.env.QUEUE_NAME;

module.exports = async function (context, req) {
    let data;
    let eventType;
    let event;
    let signature = req.headers['stripe-signature'];
    try {
        // Check if webhook signing is configured.
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.log(err);
        context.res = {
            status: 400,
            body: 'failed to verify signature'
        };
    }

    // Extract the object from the event.
    data = event.data;
    eventType = event.type;

    // Handle each events from here
    if (eventType === 'customer.created') {
        const message = {
            body: data,
            label: eventType,
        };
        // Send message to Service Bus to synchronize other service
        try {
            await sendToServiceBus(message);
            context.res = {
                status: 200,
                body: 'customer created!'
            };
        } catch (err) { 
            console.log(err);
            context.res = {
                status: 400,
                body: 'failed to send message to Azure Service Bus'
            };
        }
    }
}

async function sendToServiceBus(message) {
    const sbClient = new ServiceBusClient(connectionString);
    const sender = sbClient.createSender(queueName);
    try {
        await sender.sendMessages(message);
        await sbClient.close();
    } finally {
        await sbClient.close();
    }
}