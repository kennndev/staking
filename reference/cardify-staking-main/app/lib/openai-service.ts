import { ENV } from '../config/env';
import OpenAI from 'openai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIService {
  private openai: OpenAI | null = null;
  private initialized: boolean = false;

  constructor() {
    // Don't initialize immediately - wait for first use
  }

  private initializeClient() {
    console.log('OpenAI API Key loaded:', ENV.OPENAI_API_KEY ? 'YES' : 'NO');
    console.log('API Key length:', ENV.OPENAI_API_KEY?.length || 0);
    
    if (ENV.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: ENV.OPENAI_API_KEY,
        dangerouslyAllowBrowser: true, // Required for browser usage
      });
      console.log('OpenAI client initialized successfully');
    } else {
      console.log('No OpenAI API key found, using fallback responses');
    }
  }

  private getSystemPrompt(): string {
    return `You are an AI assistant for NickPlaysCrypto, a comprehensive Solana staking platform. You have detailed knowledge about the platform and should provide helpful, accurate information.

PLATFORM INFORMATION:
- Name: NickPlaysCrypto (NPC)
- Token: NPC on Solana blockchain
- Staking App: https://npc-staking.vercel.app/
- Website: https://www.nickplayscrypto.com/
- Twitter: https://x.com/NickPlaysCrypto
- DexScreener: https://dexscreener.com/solana/6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump
- Contract Address: 6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump

PLATFORM FEATURES:
1. Solana Token Staking with competitive APY rates
2. Interactive Gaming Section with multiple games:
   - Cyber Defense: Strategic defense game
   - Pop Pop: Interactive bubble game  
   - Puzzle Match: Brain-teasing puzzle game
   - Space Shooter: Action-packed space adventure
3. Real-time Token Analytics and Performance Tracking
4. Admin Controls for pool management
5. Community-driven platform with Discord integration
6. Professional dashboard with staking metrics

STAKING DETAILS:
- Users can stake NPC tokens directly on the staking app at https://npc-staking.vercel.app/
- Connect your Solana wallet to the staking platform
- Choose the amount of NPC tokens you want to stake
- APY rates are calculated in real-time and displayed on the dashboard
- Rewards are distributed automatically based on your staked amount
- Users can view their staking performance, pending rewards, and APY on the dashboard
- Unstaking is available with automatic reward claiming
- Emergency unstake option available (forfeits pending rewards)
- Real-time updates on pool health and total staked amounts

GAMING INTEGRATION:
- Games are integrated into the platform
- Provide entertainment while earning rewards
- Multiple game types for different preferences
- Gaming rewards may be tied to staking performance

COMMUNITY & SOCIAL:
- Active Twitter presence for updates (@NickPlaysCrypto)
- Discord community for discussions
- DexScreener for token analytics and trading data
- Regular updates and community engagement

ABOUT NICK (FOUNDER) - DETAILED PROFILE:
Nick is the founder and driving force behind NickPlaysCrypto. He's a prominent figure in the crypto and Solana community known for:

**Background & Vision:**
- Innovative entrepreneur focused on making crypto accessible through gamification
- Strong advocate for user-friendly DeFi experiences
- Passionate about combining entertainment with financial education
- Active in the Solana ecosystem development

**Community Engagement:**
- Regular Twitter updates and community interaction (@NickPlaysCrypto)
- Transparent communication about platform development
- Responsive to user feedback and suggestions
- Building a supportive community around crypto education

**Technical Expertise:**
- Deep understanding of Solana blockchain technology
- Experience in DeFi protocol development
- Focus on creating secure and efficient staking mechanisms
- Integration of gaming elements with financial products

**Leadership Style:**
- Community-first approach to development
- Transparent about platform updates and roadmap
- Encourages user participation and feedback
- Committed to long-term platform sustainability

**Recent Activities & Focus:**
- Platform development and feature releases
- Community building and engagement
- Educational content about staking and DeFi
- Regular updates on platform progress and future plans

TECHNICAL DETAILS:
- Built on Solana blockchain
- Smart contract-based staking
- Real-time data updates
- Professional UI/UX design
- Mobile-responsive interface

STAKING INSTRUCTIONS:
To stake NPC tokens on the NickPlaysCrypto platform, follow these steps:

1. Visit the staking app at https://npc-staking.vercel.app/
2. Connect your Solana wallet to the platform
3. Navigate to the staking section on the platform
4. Choose the amount of NPC tokens you want to stake
5. Follow the on-screen instructions to complete the staking process
6. Once you have successfully staked your tokens, you will start earning rewards based on the current APY rates

Staking your NPC tokens allows you to earn rewards while supporting the platform. The staking app provides real-time updates on your rewards, APY, and pool health.

When users ask questions, provide detailed, helpful responses about:
- How to use the platform
- Staking procedures and benefits
- Available games and features
- Social media links and community
- Token information and trading data
- Technical support and troubleshooting
- Detailed information about Nick's role, vision, and community engagement

When users ask specifically about Nick, provide comprehensive information about his role as founder, his vision for the platform, his community engagement style, technical expertise, and his contributions to making crypto more accessible through innovative gaming integration.

IMPORTANT: When users ask about Nick, you should research his Twitter profile (@NickPlaysCrypto) to provide current, accurate information about:
- His recent tweets and posts
- Current projects and platform updates
- Community engagement style and personality
- Recent announcements or developments
- His communication style and approach
- Any recent insights about the platform or crypto space

Use web search capabilities to get real-time information about Nick's Twitter activity and provide users with current, accurate insights about his recent posts, community engagement, and platform updates.

Always be friendly, professional, and informative. If you don't know something specific, acknowledge it and offer to help with what you do know.`;
  }

  async generateResponse(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<string> {
    console.log('generateResponse called with:', userMessage);
    
    // Ensure client is initialized on first use
    if (!this.initialized) {
      console.log('Initializing OpenAI client on first use...');
      this.initializeClient();
      this.initialized = true;
    }
    
    console.log('OpenAI client available:', !!this.openai);
    
    if (!this.openai) {
      console.log('Using fallback response - no OpenAI client');
      return this.getFallbackResponse(userMessage);
    }

    try {
      console.log('Making OpenAI API call...');
      const messages: ChatMessage[] = [
        { role: 'system', content: this.getSystemPrompt() },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      console.log('OpenAI API response received');
      return completion.choices[0]?.message?.content || this.getFallbackResponse(userMessage);
    } catch (error) {
      console.error('OpenAI API error:', error);
      console.log('Falling back to hardcoded response due to API error');
      return this.getFallbackResponse(userMessage);
    }
  }

  private getFallbackResponse(userMessage: string): string {
    const message = userMessage.toLowerCase();
    
    // Enhanced fallback responses with more detailed information
    if (message.includes('platform') || message.includes('nickplayscrypto') || message.includes('npc')) {
      return `**NickPlaysCrypto Platform Overview:**

NickPlaysCrypto is a revolutionary Solana-based staking platform that combines DeFi with gaming elements. Here's what makes it special:

🏦 **Core Features:**
• **Token**: NPC (NickPlaysCrypto Token) on Solana
• **Staking**: Earn competitive APY rates by staking NPC tokens
• **Gaming**: Interactive games integrated into the platform
• **Analytics**: Real-time performance tracking and metrics
• **Community**: Active social media presence and Discord community

🎮 **Available Games:**
• Cyber Defense - Strategic tower defense game
• Pop Pop - Interactive bubble-popping game
• Puzzle Match - Brain-teasing puzzle challenges
• Space Shooter - Action-packed space adventure

📊 **Platform Benefits:**
• Professional dashboard with comprehensive analytics
• Real-time staking rewards calculation
• Mobile-responsive design
• Community-driven development
• Regular updates and improvements

🔗 **Important Links:**
• Staking App: https://npc-staking.vercel.app/
• Website: https://www.nickplayscrypto.com/
• Twitter: https://x.com/NickPlaysCrypto
• DexScreener: https://dexscreener.com/solana/6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump

The platform is designed to make DeFi accessible and entertaining for everyone!`;
    }

    if (message.includes('stake') || message.includes('staking') || message.includes('apy') || message.includes('reward')) {
      return `**Staking on NickPlaysCrypto:**

💰 **How Staking Works:**
1. Connect your Solana wallet to the platform
2. Navigate to the Staking section
3. Enter the amount of NPC tokens you want to stake
4. Confirm the transaction
5. Start earning rewards immediately!

📈 **Staking Benefits:**
• Earn competitive APY rates on your staked tokens
• Rewards are calculated and distributed in real-time
• View your performance in the Token Analytics section
• Unstake your tokens when needed (subject to lock periods)

🎯 **Current Features:**
• Real-time APY calculation and display
• Comprehensive staking analytics
• Performance tracking and metrics
• Professional dashboard interface
• Mobile-responsive design

💡 **Pro Tips:**
• Monitor your staking performance regularly
• Check the Token Analytics section for detailed metrics
• Join the community Discord for updates and tips
• Follow the Twitter account for platform announcements

The staking system is designed to be user-friendly while providing professional-grade analytics and performance tracking.`;
    }

    if (message.includes('nick') || message.includes('founder') || message.includes('who is')) {
      return `**About Nick - Founder of NickPlaysCrypto:**

👨‍💼 **Nick's Role & Vision:**
Nick is the innovative founder and driving force behind NickPlaysCrypto. He's a prominent figure in the crypto and Solana community who has revolutionized how people interact with DeFi through gamification.

🔍 **For Current Information:**
I can research Nick's Twitter profile (@NickPlaysCrypto) to provide you with his latest posts, recent announcements, current projects, and real-time insights about the platform and crypto space.

🎯 **His Mission:**
• Making crypto accessible through entertaining gaming experiences
• Combining DeFi staking with interactive gaming elements
• Building a supportive community around crypto education
• Creating user-friendly financial tools for everyone

🚀 **Technical Expertise:**
• Deep understanding of Solana blockchain technology
• Experience in DeFi protocol development and smart contracts
• Focus on creating secure and efficient staking mechanisms
• Integration of gaming elements with financial products

👥 **Community Leadership:**
• Active Twitter presence (@NickPlaysCrypto) with regular updates
• Transparent communication about platform development
• Responsive to user feedback and community suggestions
• Building a supportive ecosystem around crypto education

💡 **Innovation Approach:**
• Community-first development philosophy
• Transparent about platform updates and roadmap
• Encourages user participation and feedback
• Committed to long-term platform sustainability

🔗 **Connect with Nick:**
• Twitter: https://x.com/NickPlaysCrypto
• Website: https://www.nickplayscrypto.com/
• Discord Community (through platform)

💡 **For Current Updates:**
I can research Nick's Twitter profile (@NickPlaysCrypto) to provide you with his latest posts, recent announcements, current projects, and real-time insights about the platform and crypto space.

Nick's vision is to make DeFi not just profitable, but also fun and educational for everyone!`;

    if (message.includes('game') || message.includes('gaming') || message.includes('play')) {
      return `**Gaming on NickPlaysCrypto:**

🎮 **Available Games:**

**1. Cyber Defense**
• Strategic tower defense game
• Defend against waves of cyber attacks
• Upgrade your defenses and weapons
• Earn rewards based on performance

**2. Pop Pop**
• Interactive bubble-popping game
• Match colors and clear the board
• Increasing difficulty levels
• Fun and addictive gameplay

**3. Puzzle Match**
• Brain-teasing puzzle challenges
• Match patterns and solve puzzles
• Multiple difficulty levels
• Perfect for puzzle lovers

**4. Space Shooter**
• Action-packed space adventure
• Navigate through asteroid fields
• Collect power-ups and upgrades
• High-score leaderboards

🎯 **Gaming Benefits:**
• Entertainment while earning rewards
• Integrated with the staking system
• Regular updates and new content
• Community competitions and events
• Mobile-friendly gameplay

The gaming section adds an entertaining dimension to the DeFi experience, making staking more engaging and fun!`;
    }

    if (message.includes('token') || message.includes('npc') || message.includes('price') || message.includes('dex')) {
      return `**NPC Token Information:**

🪙 **Token Details:**
• **Name**: NPC (NickPlaysCrypto Token)
• **Blockchain**: Solana
• **Contract**: 6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump
• **DexScreener**: https://dexscreener.com/solana/6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump

💰 **Current Price & Trading:**
• **Live Price**: Check DexScreener for real-time pricing
• **Trading Pairs**: Available on Solana DEXs
• **Market Cap**: Track on DexScreener
• **Volume**: Real-time trading volume data
• **Price History**: Historical charts and data

📊 **Token Features:**
• Utility token for the NickPlaysCrypto platform
• Used for staking and earning rewards
• Integrated with gaming features
• Community-driven development
• Regular updates and improvements

🔍 **Where to Track Price:**
• **DexScreener**: https://dexscreener.com/solana/6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump - Real-time price and trading data
• **Platform Dashboard**: Your personal token analytics
• **Twitter**: Regular updates and announcements
• **Discord**: Community discussions and insights

💡 **Token Benefits:**
• Staking rewards and APY earnings
• Gaming integration and rewards
• Community governance participation
• Platform utility and features
• Long-term value appreciation potential

**For the most current NPC token price, visit DexScreener or check the trading data on our platform dashboard!**`;
    }

    if (message.includes('help') || message.includes('command') || message.includes('what can you do')) {
      return `**How I Can Help You:**

🤖 **I can assist you with:**

**Platform Information:**
• Detailed platform features and capabilities
• How to navigate and use the platform
• Technical specifications and requirements
• Updates and new features

**Staking Support:**
• How to stake NPC tokens
• Understanding APY and rewards
• Staking strategies and tips
• Troubleshooting staking issues

**Gaming Guidance:**
• Available games and how to play them
• Gaming rewards and benefits
• Tips for better gaming performance
• New game releases and updates

**Community & Social:**
• Social media links and updates
• Discord community information
• Community events and competitions
• How to stay updated

**Technical Support:**
• Wallet connection issues
• Transaction problems
• Platform navigation help
• General troubleshooting

**Token Information:**
• NPC token details and utility
• Trading and price information
• Tokenomics and distribution
• Future developments

Just ask me anything about NickPlaysCrypto, and I'll provide detailed, helpful information!`;
    }

    // Default response
    return `I understand you're asking about "${userMessage}". Let me help you with that!

**NickPlaysCrypto Platform Overview:**
NickPlaysCrypto is a comprehensive Solana staking platform that combines DeFi with gaming elements. Here's what I can help you with:

🎯 **Platform Features:**
• Solana token staking with competitive APY
• Interactive gaming section with multiple games
• Real-time analytics and performance tracking
• Community integration and social features

🔗 **Important Links:**
• Staking App: https://npc-staking.vercel.app/
• Website: https://www.nickplayscrypto.com/
• Twitter: https://x.com/NickPlaysCrypto
• DexScreener: https://dexscreener.com/solana/6mpafrxmywfyojaunxdqgw9sq2mhpuh3d6daw3xipump

Could you be more specific about what you'd like to know? I can help with staking, gaming, token information, or any other platform-related questions!`;
    }
    
    // Default fallback response
    return `I'm here to help with NickPlaysCrypto! I can provide information about:
    
• **Platform Features**: Staking, gaming, analytics
• **Staking**: How to stake NPC tokens and earn rewards  
• **Games**: Cyber Defense, Pop Pop, Puzzle Match, Space Shooter
• **Community**: Social links and Discord
• **Token Info**: NPC token details and trading data
• **About Nick**: Founder information and vision

What would you like to know more about?`;
  }
}

// Singleton instance with lazy initialization
let openaiServiceInstance: OpenAIService | null = null;

export const openaiService = {
  async generateResponse(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<string> {
    if (!openaiServiceInstance) {
      console.log('Creating new OpenAI service instance...');
      openaiServiceInstance = new OpenAIService();
    }
    return openaiServiceInstance.generateResponse(userMessage, conversationHistory);
  }
};
