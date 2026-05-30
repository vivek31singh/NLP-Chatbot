$baseUrl = "http://localhost:8000/api/v1/chat"

function Send-Log($message, $botResponse, $sessionId, $intent, $confidence) {
    $body = @{
        message = $message
        bot_response = $botResponse
        session_id = $sessionId
        intent = $intent
        confidence = $confidence
    } | ConvertTo-Json
    
    try {
        $resp = Invoke-RestMethod -Uri "$baseUrl/log" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10
        return $resp.conversation_id
    } catch {
        Write-Host "  ERROR: $($_.Exception.Message)"
        return $null
    }
}

function Send-Feedback($convId, $rating, $comment = "") {
    $body = @{ conversation_id = $convId; rating = $rating; comment = $comment } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$baseUrl/feedback" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10 | Out-Null
    } catch {}
}

Write-Host "=== Seeding Chat Data (via /log endpoint) ===`n"

# Conv 1: Order status - 4 messages
Write-Host "1. Order status inquiry"
$cid = Send-Log "Hello, I need help with my order" "Hello! Welcome to our customer support. How can I help you today?" "user-001" "greet" 0.98
Start-Sleep -Milliseconds 200
Send-Log "I want to check my order status" "Sure, I can help with that. Could you please provide your order ID? It usually looks like ORD-12345." "user-001" "check_order_status" 0.95
Start-Sleep -Milliseconds 200
Send-Log "My order number is ORD-12345" "I found your order ORD-12345. Let me pull up the details for you." "user-001" "check_order_status" 0.93
Start-Sleep -Milliseconds 200
Send-Log "Thanks, that's all I needed" "You're welcome! Is there anything else I can help with?" "user-001" "small_talk" 0.91
Send-Feedback $cid 5 "Quick and helpful"

# Conv 2: Return/refund
Write-Host "2. Return and refund"
$cid = Send-Log "Hi there" "Hi there! I'm your virtual assistant. What can I do for you?" "user-002" "greet" 0.99
Start-Sleep -Milliseconds 200
Send-Log "I need to return a damaged item" "I'd be happy to help with returns. Could you please provide your order number so I can look into this?" "user-002" "return_refund" 0.94
Start-Sleep -Milliseconds 200
Send-Log "Order ORD-67890, the item arrived broken" "Your return request has been initiated for order ORD-67890. You'll receive a return shipping label at your email. Once we receive the item, we'll process your refund within 5-7 business days." "user-002" "return_refund" 0.92
Send-Feedback $cid 4 "Good return process"

# Conv 3: Billing charge
Write-Host "3. Billing inquiry"
$cid = Send-Log "Hi, I have a billing question" "I can help with billing questions. Could you provide more details about what you'd like to know?" "user-003" "billing_question" 0.96
Start-Sleep -Milliseconds 200
Send-Log "I see a charge on my card that I don't recognize" "I'd be happy to look into a charge for you. Could you please provide your order ID?" "user-003" "billing_charge" 0.94
Start-Sleep -Milliseconds 200
Send-Log "The order number is ORD-11111" "I found your order. The charge of $49.99 is for your recent purchase. Would you like more details?" "user-003" "billing_charge" 0.91
Send-Feedback $cid 3 "Took a while to resolve"

# Conv 4: Product inquiry
Write-Host "4. Product inquiry"
$cid = Send-Log "Hello, I'm looking for information about your products" "I'd be happy to help with product information. Which product are you interested in?" "user-004" "product_inquiry" 0.95
Start-Sleep -Milliseconds 200
Send-Log "Tell me about wireless headphones" "We have several wireless headphone options ranging from $29.99 to $199.99. Our top sellers include the SoundWave Pro and the BassBuds X. Would you like details on a specific model?" "user-004" "product_inquiry" 0.89
Send-Feedback $cid 5 "Very informative"

# Conv 5: Track order
Write-Host "5. Track order"
$cid = Send-Log "Can you help me track my order?" "Sure, I can help you track your order. Please provide your order number." "user-005" "track_order" 0.97
Start-Sleep -Milliseconds 200
Send-Log "My order number is ORD-22222" "Your order ORD-22222 is currently in transit. It was shipped on May 25th and is expected to arrive by June 1st. The tracking number is TRK987654321." "user-005" "track_order" 0.95
Send-Feedback $cid 4 "Order found quickly"

# Conv 6: Complaint + handoff
Write-Host "6. Complaint with handoff"
$cid = Send-Log "I want to file a complaint" "I'm sorry to hear about your experience. Your feedback is important to us. Could you please tell me more about the issue?" "user-006" "complaint" 0.93
Start-Sleep -Milliseconds 200
Send-Log "I received the wrong item in my package" "I sincerely apologize for the inconvenience. Let me look into this right away. Can you provide your order number?" "user-006" "complaint" 0.90
Start-Sleep -Milliseconds 200
Send-Log "Can I talk to a human agent please" "I'm connecting you with a human agent who can better assist you. Please hold on for a moment." "user-006" "handoff_to_human" 0.96
Send-Feedback $cid 2 "Still unresolved"

# Conv 7: Simple greet + goodbye
Write-Host "7. Quick greeting"
$cid = Send-Log "Hi" "Hello! Welcome to our customer support. How can I help you today?" "user-007" "greet" 0.99
Start-Sleep -Milliseconds 200
Send-Log "Thanks, bye" "Thank you for contacting us! Have a great day." "user-007" "goodbye" 0.98

# Conv 8: Bot challenge
Write-Host "8. Bot challenge"
$cid = Send-Log "What are you?" "I am a customer support chatbot powered by AI. I can help you with orders, returns, billing, and product information." "user-008" "bot_challenge" 0.97
Start-Sleep -Milliseconds 200
Send-Log "Can you help me check my order?" "Sure, I can help with that. Could you please provide your order ID?" "user-008" "check_order_status" 0.94
Start-Sleep -Milliseconds 200
Send-Log "Order ORD-33333" "I found your order ORD-33333. Let me pull up the details for you." "user-008" "check_order_status" 0.93
Send-Feedback $cid 4 ""

# Conv 9: Payment method
Write-Host "9. Payment method question"
$cid = Send-Log "What payment methods do you accept?" "We accept the following payment methods: Credit Card (Visa, Mastercard, Amex), Debit Card, UPI, Bank Transfer, and Net Banking." "user-009" "billing_payment_method" 0.96
Send-Feedback $cid 5 "Clear information"

# Conv 10: Out of scope
Write-Host "10. Out of scope query"
$cid = Send-Log "What's the weather like today?" "I'm sorry, I didn't quite understand that. Could you please rephrase your question?" "user-010" "out_of_scope" 0.72
Start-Sleep -Milliseconds 200
Send-Log "I mean can you check my order ORD-44444" "Sure, I can help you track your order. Please provide your order ID so I can find your order." "user-010" "track_order" 0.94
Send-Feedback $cid 3 ""

# Conv 11: Small talk
Write-Host "11. Small talk"
$cid = Send-Log "You're doing a great job" "Thank you! I'm here to help. Is there anything else I can assist you with regarding your orders, returns, or billing?" "user-011" "small_talk" 0.88
Start-Sleep -Milliseconds 200
Send-Log "I want to check order ORD-55555" "I found your order ORD-55555. Let me pull up the details for you." "user-011" "check_order_status" 0.95
Send-Feedback $cid 5 ""

# Conv 12: Invoice request
Write-Host "12. Invoice request"
$cid = Send-Log "I need a copy of my invoice" "I can help you get a copy of your invoice. Could you please provide your order ID?" "user-012" "billing_invoice" 0.95
Start-Sleep -Milliseconds 200
Send-Log "For order ORD-66666" "I've found the invoice for order ORD-66666. It has been sent to your registered email address. The total amount was $79.99 plus tax." "user-012" "billing_invoice" 0.93
Send-Feedback $cid 4 "Got the invoice"

# Conv 13: Low confidence for uncertain predictions
Write-Host "13. Low confidence messages"
$cid = Send-Log "I wanna speak to someone who can fix my thing" "I'm having trouble understanding your request. Could you try asking in a different way?" "user-013" "out_of_scope" 0.45
Start-Sleep -Milliseconds 200
Send-Log "my purchase is messed up man" "I'm sorry, I didn't quite understand that. Could you please rephrase your question?" "user-013" "out_of_scope" 0.38

# Conv 14: Another conversation
Write-Host "14. Greet and capabilities"
$cid = Send-Log "Hey" "Hello! Welcome to our customer support. How can I help you today?" "user-014" "greet" 0.98
Start-Sleep -Milliseconds 200
Send-Log "What can you help me with?" "I can help you with: Track Order, Return/Refund, Billing Questions, Product Information, Order Details, and Complaints. Just type what you need help with!" "user-014" "ask_capabilities" 0.95
Send-Feedback $cid 5 ""

# Conv 15: Frustrated user
Write-Host "15. Frustrated user"
$cid = Send-Log "This is ridiculous, I've been waiting for days!" "I understand your frustration, and I'm sorry for the inconvenience. Let me connect you with a human agent right away." "user-015" "frustrated" 0.91
Send-Feedback $cid 2 "Not helpful"

Write-Host "`n=== Seeding Complete ==="

# Verify
Write-Host "`nVerifying data..."
$convCount = (Invoke-RestMethod -Uri "$baseUrl/conversations" -TimeoutSec 5).Count
Write-Host "Total conversations: $convCount"
