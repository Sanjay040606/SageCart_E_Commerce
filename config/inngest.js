import { Inngest } from "inngest";
import connectDB from "./db";
import User from "@/models/User";
import Order from "@/models/Order";
import { ORDER_STATUSES, getOrderMilestones, syncOrderWithSystemTime } from "@/lib/orderLifecycle";
import { sendOrderLifecycleEmailsIfNeeded, sendWelcomeEmailIfNeeded } from "@/lib/emailNotifications";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "sagecart-next" });

// inngest Function to save  user data to a database
export const syncUserCreation = inngest.createFunction(
    {
        id:'sync-user-from-clerk'
    },
    { event: 'clerk/user.created'},
    async ({event}) => {
        const { id, first_name, last_name, email_addresses, image_url} = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            imageUrl:image_url
        }
        await connectDB()
        const user = await User.create(userData)
        await sendWelcomeEmailIfNeeded(user)
    }
)

// Inngest Function to update user data in Database
export const syncUserUpdation = inngest.createFunction(
    {
        id: 'update-user-from-clerk'
    },
    {event : 'clerk/user.updated'},
    async ({event}) => {
        const { id, first_name, last_name, email_addresses, image_url} = event.data
        const userData = {
            _id: id,
            email: email_addresses[0].email_address,
            name: first_name + ' ' + last_name,
            imageUrl:image_url
        }
        await connectDB()
        await User.findByIdAndUpdate(id,userData)
    }
)

//Inngest Function to Delete user data in Database
export const syncUserDeletion = inngest.createFunction(
    {
        id: 'delete-user-with-clerk'
    },
    { event: 'clerk/user.deleted'},
    async ({event}) => {
        const {id } = event.data

        await connectDB()
        await User.findByIdAndDelete(id)
    }
)

// Inngest Function to create user's order in database
export const createUserOrder = inngest.createFunction(
    {
        id:'create-user-order',
        batchEvents: {
            maxSize: 5,
            timeout: '5s'
        }
    },
    {event : 'order/created'},
    async ({events}) => {

        const orders = events.map((event) => {
            const placedAt = event.data.date || Date.now()
            const { deliveryEta } = getOrderMilestones({ date: placedAt })

            return{
                userId: event.data.userId,
                items: event.data.items,
                amount: event.data.amount || 0,
                amountInr: event.data.amountInr || 0,
                originalTotalInr: event.data.originalTotalInr || event.data.amountInr || 0,
                subTotalInr: event.data.subTotalInr || event.data.amountInr || 0,
                shippingInr: event.data.shippingInr || 0,
                discountInr: event.data.discountInr || 0,
                promoCode: event.data.promoCode || '',
                paymentMethod: event.data.paymentMethod || 'COD',
                address: event.data.address,
                status: ORDER_STATUSES.CONFIRMED,
                statusTimeline: [
                    {
                        status: ORDER_STATUSES.CONFIRMED,
                        timestamp: new Date(placedAt),
                        message: 'Your order has been confirmed.'
                    }
                ],
                estimatedDeliveryDate: deliveryEta,
                date: placedAt
            }
        })
        
        await connectDB()
        await Order.insertMany(orders)

        return { success: true, processed: orders.length};
    }
)

// Scheduled function to automatically update order statuses every 24 hours
export const updateOrderStatuses = inngest.createFunction(
    {
        id: 'update-order-statuses',
    },
    { cron: '0 * * * *' }, // Run every hour
    async () => {
        await connectDB()
        
        const orders = await Order.find({})
        
        for (const order of orders) {
            const { changed } = syncOrderWithSystemTime(order)
            if (changed) {
                await order.save()
            }
            await sendOrderLifecycleEmailsIfNeeded(order)
        }
        
        return { success: true, message: 'Order statuses updated' }
    }
)
